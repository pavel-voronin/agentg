import { createAppEvent, type AppEvent, type JsonObject } from '../bus/events.js';
import type { TelegramHistoryFetchPageResult, TelegramService } from '../telegram/telegramService.js';
import type { HistoryCoverageInterval } from './coverage.js';
import {
  checkpointBackfillPage,
  TELEGRAM_HISTORY_PAST_BOUNDARY,
  type HistoryJob,
  type HistoryJobCursor
} from './jobs.js';
import type {
  HistoryBoundary,
  HistoryRange,
  HistoryRepository,
  HistoryTarget
} from './historyRepository.js';
import { normalizeHistoryInterval } from './ranges.js';
import { reconcileChat, type HistoryTarget as ReconcilerHistoryTarget } from './reconciler.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const SECOND_MS = 1000;
const WEEK_MS = 7 * DAY_MS;
const DURATION_UNIT_ORDER = ['y', 'mo', 'w', 'd', 'h', 'm', 's'] as const;

export type HistorySyncOptions = {
  chatLoadBatchSize: number;
  discoverChats?: boolean;
  jobWindowDays: number;
  messageLimit: number;
  publishEvent?: (event: AppEvent) => Promise<void> | void;
  requestDelayMs: number;
};

type BackfillJobExecutionResult = {
  fetchedMessages: number;
  reachedBeginning: boolean;
  storedMessages: number;
};

export async function runHistorySync(
  repository: HistoryRepository,
  telegramService: TelegramService,
  options: HistorySyncOptions
): Promise<void> {
  const safeOptions = normalizeHistorySyncOptions(options);
  const now = truncateToTelegramSecond(new Date());
  await emitHistoryEvent(safeOptions, 'history.sync.started', {
    now: now.toISOString()
  });

  const chats =
    safeOptions.discoverChats === true
      ? await telegramService.discoverChats({ loadBatchSize: safeOptions.chatLoadBatchSize })
      : telegramService.listChats({ limit: 2000 });

  repository.resetRunningJobs();
  const targets = projectTargets(repository.listTargets(), now);
  const createdJobs = await reconcileHistoryTargets(repository, targets, now, safeOptions);
  await executePendingBackfillJobs(repository, telegramService, now, safeOptions);
  await emitHistoryEvent(safeOptions, 'history.sync.completed', {
    chats: chats.length,
    createdJobs,
    targets: targets.length
  });
}

async function reconcileHistoryTargets(
  repository: HistoryRepository,
  targets: ReconcilerHistoryTarget[],
  now: Date,
  options: HistorySyncOptions
): Promise<number> {
  let createdJobs = 0;
  const chatIds = [...new Set(targets.map((target) => target.chatId))];

  for (const chatId of chatIds) {
    const coverage = repository.listCoverage(chatId);
    const jobs = reconcileChat({
      chatId,
      coverage,
      jobWindowMilliseconds: options.jobWindowDays * 24 * 60 * 60 * 1000,
      targets
    });

    createdJobs += repository.createJobs(jobs.slice(0, 1)).length;
  }

  await emitHistoryEvent(options, 'history.reconcile.completed', {
    chats: chatIds.length,
    createdJobs,
    now: now.toISOString()
  });

  return createdJobs;
}

async function executePendingBackfillJobs(
  repository: HistoryRepository,
  telegramService: TelegramService,
  now: Date,
  options: HistorySyncOptions
): Promise<void> {
  for (;;) {
    const job = repository.claimNextJob();
    if (job === undefined) {
      const createdJobs = await reconcileHistoryTargets(
        repository,
        projectTargets(repository.listTargets(), now),
        now,
        options
      );
      if (createdJobs === 0) {
        console.log(JSON.stringify({ event: 'history_sync.complete' }));
        return;
      }
      continue;
    }

    const coverage = repository.listCoverage(job.chatId);
    if (coverage.some((interval) => coversJob(interval, job))) {
      repository.completeJob(job, {
        chatId: job.chatId,
        endAt: job.endAt,
        source: 'backfill',
        startAt: job.startAt
      });
      continue;
    }

    try {
      await emitHistoryEvent(options, 'history.job.started', {
        chatId: job.chatId,
        jobEnd: job.endAt.toISOString(),
        jobId: String(job.id),
        jobStart: job.startAt.toISOString()
      });
      const result = await executeBackfillJob(repository, telegramService, job, options);
      await emitHistoryEvent(options, 'history.job.completed', {
        chatId: job.chatId,
        fetchedMessages: result.fetchedMessages,
        jobEnd: job.endAt.toISOString(),
        jobId: String(job.id),
        jobStart: job.startAt.toISOString(),
        reachedBeginning: result.reachedBeginning,
        storedMessages: result.storedMessages
      });

      console.log(
        JSON.stringify({
          event: 'history_sync.backfill_job_complete',
          chatId: job.chatId,
          fetchedMessages: result.fetchedMessages,
          jobEnd: job.endAt.toISOString(),
          jobStart: job.startAt.toISOString(),
          reachedBeginning: result.reachedBeginning,
          storedMessages: result.storedMessages
        })
      );
    } catch (error) {
      repository.resetJob(job);
      await emitHistoryEvent(options, 'history.job.failed', {
        chatId: job.chatId,
        error: error instanceof Error ? error.message : String(error),
        jobEnd: job.endAt.toISOString(),
        jobId: String(job.id),
        jobStart: job.startAt.toISOString()
      });
      throw error;
    }
  }
}

async function executeBackfillJob(
  repository: HistoryRepository,
  telegramService: TelegramService,
  job: HistoryJob,
  options: Pick<HistorySyncOptions, 'messageLimit' | 'publishEvent' | 'requestDelayMs'>
): Promise<BackfillJobExecutionResult> {
  let remainingEndAt = job.endAt;
  let cursorMessageId = readCursorMessageId(job.cursor);
  let fetchedMessages = 0;
  let storedMessages = 0;

  for (;;) {
    await delay(options.requestDelayMs);

    const page = await telegramService.fetchHistoryPage({
      chatId: job.chatId,
      ...(cursorMessageId === undefined ? {} : { cursorMessageId }),
      endAt: remainingEndAt.toISOString(),
      limit: options.messageLimit,
      startAt: job.startAt.toISOString()
    });

    if (page.kind === 'no_messages_before_end') {
      completeJobWithCoverage(repository, job, options, {
        endAt: remainingEndAt,
        startAt: TELEGRAM_HISTORY_PAST_BOUNDARY
      });
      return {
        fetchedMessages,
        reachedBeginning: true,
        storedMessages
      };
    }

    if (page.kind === 'anchor_before_start') {
      completeJobWithCoverage(repository, job, options, {
        endAt: remainingEndAt,
        startAt: job.startAt
      });
      return {
        fetchedMessages,
        reachedBeginning: false,
        storedMessages
      };
    }

    fetchedMessages += page.fetchedMessages;
    storedMessages += page.storedMessages;
    const result = checkpointPage(repository, job, page, remainingEndAt, options);

    if (result.done) {
      return {
        fetchedMessages,
        reachedBeginning: page.reachedBeginning,
        storedMessages
      };
    }

    cursorMessageId = result.cursorMessageId;
    remainingEndAt = result.remainingEndAt;
  }
}

function checkpointPage(
  repository: HistoryRepository,
  job: HistoryJob,
  page: Extract<TelegramHistoryFetchPageResult, { kind: 'page' }>,
  remainingEndAt: Date,
  options: Pick<HistorySyncOptions, 'publishEvent'>
): {
  done: boolean;
  remainingEndAt: Date;
  cursorMessageId?: number;
} {
  const nextCursorMessageId = page.nextCursorMessageId;
  const oldestFetchedMessageDate =
    page.oldestFetchedMessageDate === undefined
      ? undefined
      : new Date(page.oldestFetchedMessageDate);
  const checkpoint = checkpointBackfillPage(job, {
    crossedStart: page.crossedStart,
    ...(oldestFetchedMessageDate === undefined ? {} : { oldestFetchedMessageDate }),
    reachedBeginning: page.reachedBeginning,
    remainingEndAt
  });

  repository.checkpointJob(job, {
    complete: checkpoint.complete,
    ...(checkpoint.coveredInterval === undefined
      ? {}
      : { coveredInterval: { ...checkpoint.coveredInterval, source: 'backfill' } }),
    ...(checkpoint.complete || nextCursorMessageId === undefined
      ? {}
      : { cursor: { messageId: nextCursorMessageId } }),
    remainingEndAt: checkpoint.remainingEndAt
  });

  if (checkpoint.coveredInterval !== undefined) {
    void emitCoverageChanged(options, {
      ...checkpoint.coveredInterval,
      source: 'backfill'
    });
  }

  return {
    done: nextCursorMessageId === undefined || checkpoint.complete,
    ...(nextCursorMessageId === undefined ? {} : { cursorMessageId: nextCursorMessageId }),
    remainingEndAt: checkpoint.remainingEndAt
  };
}

function completeJobWithCoverage(
  repository: HistoryRepository,
  job: HistoryJob,
  options: Pick<HistorySyncOptions, 'publishEvent'>,
  interval: {
    endAt: Date;
    startAt: Date;
  }
): void {
  const coveredInterval: HistoryCoverageInterval = {
    chatId: job.chatId,
    endAt: interval.endAt,
    source: 'backfill',
    startAt: interval.startAt
  };
  repository.completeJob(job, coveredInterval);
  void emitCoverageChanged(options, coveredInterval);
}

async function emitCoverageChanged(
  options: Pick<HistorySyncOptions, 'publishEvent'>,
  interval: HistoryCoverageInterval
): Promise<void> {
  await emitHistoryEvent(options, 'history.coverage.changed', {
    chatId: interval.chatId,
    endAt: interval.endAt.toISOString(),
    startAt: interval.startAt.toISOString()
  });
}

function projectTargets(targets: HistoryTarget[], now: Date): ReconcilerHistoryTarget[] {
  return targets.map((target) => ({
    chatId: target.chatId,
    ...projectHistoryRange(target.range, now)
  }));
}

function projectHistoryRange(range: HistoryRange, now: Date): { endAt: Date; startAt: Date } {
  return normalizeHistoryInterval({
    endAt: resolveBoundary(range.end, now),
    startAt: resolveBoundary(range.start, now)
  });
}

function resolveBoundary(boundary: HistoryBoundary, now: Date): Date {
  if (boundary.kind === 'absolute') {
    return parseDate(boundary.at);
  }

  const expression = boundary.expression.trim();
  if (expression === 'now') {
    return now;
  }
  if (expression === 'past') {
    return TELEGRAM_HISTORY_PAST_BOUNDARY;
  }

  const relativeDate = resolveRelativeExpression(expression, now);
  if (relativeDate !== undefined) {
    return relativeDate;
  }

  return parseDate(expression);
}

function resolveRelativeExpression(expression: string, now: Date): Date | undefined {
  const compact = expression.replace(/\s+/g, '');
  const base = relativeExpressionBase(compact, now);
  if (base === undefined) {
    return undefined;
  }

  let date = new Date(base.date);
  let offset = base.expression.length;
  const operationPattern = /([+-])([^+-]+)/g;
  operationPattern.lastIndex = offset;
  for (;;) {
    const operation = operationPattern.exec(compact);
    if (operation === null) {
      break;
    }
    if (operation.index !== offset || operation[1] === undefined || operation[2] === undefined) {
      return undefined;
    }
    const duration = parseDuration(operation[2]);
    if (duration === undefined) {
      return undefined;
    }
    date = applyDuration(date, duration, operation[1] === '+' ? 1 : -1);
    offset = operation.index + operation[0].length;
  }

  return offset === compact.length && offset > base.expression.length ? date : undefined;
}

function relativeExpressionBase(
  expression: string,
  now: Date
): { date: Date; expression: string } | undefined {
  const candidates = [
    { date: now, expression: 'now' },
    { date: TELEGRAM_HISTORY_PAST_BOUNDARY, expression: 'past' }
  ].sort((left, right) => right.expression.length - left.expression.length);

  return candidates.find(
    (candidate) =>
      expression.startsWith(candidate.expression) &&
      ['+', '-'].includes(expression[candidate.expression.length] ?? '')
  );
}

function applyDuration(
  date: Date,
  duration: {
    d: number;
    h: number;
    m: number;
    mo: number;
    s: number;
    w: number;
    y: number;
  },
  direction: -1 | 1
): Date {
  const shifted = shiftCalendarDuration(date, direction * duration.y, direction * duration.mo);
  const fixedMilliseconds =
    duration.w * WEEK_MS +
    duration.d * DAY_MS +
    duration.h * HOUR_MS +
    duration.m * MINUTE_MS +
    duration.s * SECOND_MS;
  return new Date(shifted.getTime() + direction * fixedMilliseconds);
}

function parseDuration(value: string):
  | {
      d: number;
      h: number;
      m: number;
      mo: number;
      s: number;
      w: number;
      y: number;
    }
  | undefined {
  const compact = value.replace(/\s+/g, '');
  if (compact.length === 0) {
    return undefined;
  }

  const duration = { d: 0, h: 0, m: 0, mo: 0, s: 0, w: 0, y: 0 };
  let offset = 0;
  let previousOrder = -1;
  const tokenPattern = /(\d+)(y|mo|w|d|h|m|s)/g;
  for (;;) {
    const token = tokenPattern.exec(compact);
    if (token === null) {
      break;
    }
    if (token.index !== offset || token[1] === undefined || token[2] === undefined) {
      return undefined;
    }
    const unit = token[2] as keyof typeof duration;
    const order = DURATION_UNIT_ORDER.indexOf(unit);
    const amount = Number.parseInt(token[1], 10);
    if (!Number.isSafeInteger(amount) || amount <= 0 || order <= previousOrder) {
      return undefined;
    }
    duration[unit] = amount;
    previousOrder = order;
    offset = token.index + token[0].length;
  }

  return offset === compact.length && offset > 0 ? duration : undefined;
}

function shiftCalendarDuration(date: Date, years: number, months: number): Date {
  if (years === 0 && months === 0) {
    return new Date(date);
  }

  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + years * 12 + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths - targetYear * 12;
  const targetDay = Math.min(date.getUTCDate(), daysInUtcMonth(targetYear, targetMonth));
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

async function emitHistoryEvent(
  options: Pick<HistorySyncOptions, 'publishEvent'>,
  type: string,
  data: JsonObject
): Promise<void> {
  await options.publishEvent?.(
    createAppEvent({
      data,
      source: 'history',
      type
    })
  );
}

function coversJob(interval: HistoryCoverageInterval, job: HistoryJob): boolean {
  return interval.startAt <= job.startAt && interval.endAt >= job.endAt;
}

function normalizeHistorySyncOptions(options: HistorySyncOptions): HistorySyncOptions {
  return {
    chatLoadBatchSize: Math.max(1, options.chatLoadBatchSize),
    discoverChats: options.discoverChats ?? true,
    jobWindowDays: Math.max(1, options.jobWindowDays),
    messageLimit: Math.min(100, Math.max(1, options.messageLimit)),
    ...(options.publishEvent === undefined ? {} : { publishEvent: options.publishEvent }),
    requestDelayMs: Math.max(0, options.requestDelayMs)
  };
}

function readCursorMessageId(cursor: HistoryJobCursor | undefined): number | undefined {
  return typeof cursor?.messageId === 'number' ? cursor.messageId : undefined;
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid history date boundary: ${value}`);
  }
  return date;
}

function truncateToTelegramSecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
