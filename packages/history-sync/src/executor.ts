import type { HistoryDatabase as AppDatabase } from './database.js';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/shared/events/envelope';
import type { JsonObject } from '@agentg/shared/json';

import { TELEGRAM_HISTORY_PAST_BOUNDARY } from './constants.js';
import { historyCoverageChangedData, historyJobEventData } from './events.js';
import { checkpointBackfillPage } from './jobs.js';
import { materializeTemplatesForChat } from './materialization.js';
import { completedOneShotTargets, reconcileChat } from './reconciler.js';
import {
  checkpointBackfillJob,
  claimNextBackfillJob,
  completeBackfillJob,
  createBackfillJobs,
  deleteHistoryTarget,
  listHistoryCoverage,
  listHistoryTargets,
  listHistoryTemplates,
  resetBackfillJob,
  resetRunningBackfillJobs,
  upsertHistoryTargets
} from './store.js';
import type { TelegramHistoryClient } from './telegram-client.js';
import type { BackfillJob, HistoryTarget, TelegramChatForHistory } from './types.js';

export type HistorySyncOptions = {
  chatLoadBatchSize: number;
  discoverChats?: boolean;
  jobWindowDays: number;
  messageLimit: number;
  publishEvent?: (event: IntegrationEvent) => void;
  requestDelayMs: number;
};

type BackfillJobExecutionResult = {
  fetchedMessages: number;
  historyStartAt?: string;
  reachedBeginning: boolean;
  storedMessages: number;
};

export async function runHistorySync(
  database: AppDatabase,
  client: TelegramHistoryClient,
  options: HistorySyncOptions
): Promise<void> {
  const safeOptions = normalizeHistorySyncOptions(options);
  const reconcileNow = truncateToTelegramSecond(new Date());
  emitHistoryEvent(safeOptions, 'history.sync.started', {
    now: reconcileNow.toISOString()
  });
  const chats = await client.listChats({
    discover: safeOptions.discoverChats === true,
    loadBatchSize: safeOptions.chatLoadBatchSize
  });
  const targets = await materializeHistoryTargets(database, chats, safeOptions);

  await resetRunningBackfillJobs(database);
  const createdJobs = await reconcileHistoryTargets(database, targets, reconcileNow, safeOptions);
  await executePendingBackfillJobs(database, client, reconcileNow, safeOptions);
  emitHistoryEvent(safeOptions, 'history.sync.completed', {
    chats: chats.length,
    createdJobs,
    targets: targets.length
  });
}

async function materializeHistoryTargets(
  database: AppDatabase,
  chats: TelegramChatForHistory[],
  options: HistorySyncOptions
): Promise<HistoryTarget[]> {
  const templates = await listHistoryTemplates(database);
  const chatIds = new Set(chats.map((chat) => chat.id));
  let targets = await deleteTargetsForUnlistedChats(
    database,
    await listHistoryTargets(database),
    chatIds,
    options
  );
  for (const chat of chats) {
    targets = materializeTemplatesForChat(templates, chat, targets);
  }

  await upsertHistoryTargets(database, targets);
  return targets;
}

async function deleteTargetsForUnlistedChats(
  database: AppDatabase,
  targets: HistoryTarget[],
  chatIds: Set<string>,
  options: HistorySyncOptions
): Promise<HistoryTarget[]> {
  const activeTargets: HistoryTarget[] = [];
  for (const target of targets) {
    if (chatIds.has(target.chatId)) {
      activeTargets.push(target);
      continue;
    }
    const deleted = await deleteHistoryTarget(database, target.id);
    if (deleted !== undefined) {
      emitHistoryEvent(options, 'history.target.auto_deleted', {
        chatId: target.chatId,
        targetId: target.id
      });
    }
  }
  return activeTargets;
}

async function reconcileHistoryTargets(
  database: AppDatabase,
  targets: HistoryTarget[],
  now: Date,
  options: HistorySyncOptions
): Promise<number> {
  let createdJobs = 0;
  const chatIds = [...new Set(targets.map((target) => target.chatId))];
  let activeTargets = targets;

  for (const chatId of chatIds) {
    const coverage = await listHistoryCoverage(database, chatId);
    const completedTargets = completedOneShotTargets({
      chatId,
      coverage,
      jobWindowMilliseconds: options.jobWindowDays * 24 * 60 * 60 * 1000,
      literals: {
        past: TELEGRAM_HISTORY_PAST_BOUNDARY
      },
      now,
      targets: activeTargets
    });
    for (const target of completedTargets) {
      const deleted = await deleteHistoryTarget(database, target.id);
      if (deleted !== undefined) {
        activeTargets = activeTargets.filter((existing) => existing.id !== target.id);
        emitHistoryEvent(options, 'history.target.auto_deleted', {
          chatId: target.chatId,
          targetId: target.id
        });
      }
    }
    const jobs = reconcileChat({
      chatId,
      coverage,
      jobWindowMilliseconds: options.jobWindowDays * 24 * 60 * 60 * 1000,
      literals: {
        past: TELEGRAM_HISTORY_PAST_BOUNDARY
      },
      now,
      targets: activeTargets
    });

    const newJobs = await createBackfillJobs(database, jobs.slice(0, 1));
    for (const job of newJobs) {
      emitHistoryEvent(options, 'history.job.created', historyJobEventData(job));
    }
    createdJobs += newJobs.length;
  }

  emitHistoryEvent(options, 'history.reconcile.completed', {
    chats: chatIds.length,
    createdJobs
  });

  return createdJobs;
}

async function executePendingBackfillJobs(
  database: AppDatabase,
  client: TelegramHistoryClient,
  now: Date,
  options: HistorySyncOptions
): Promise<void> {
  for (;;) {
    const job = await claimNextBackfillJob(database);
    if (job === undefined) {
      const targets = await listHistoryTargets(database);
      const createdJobs = await reconcileHistoryTargets(database, targets, now, options);
      if (createdJobs === 0) {
        console.log(JSON.stringify({ event: 'history_sync.complete' }));
        return;
      }
      continue;
    }

    const coverage = await listHistoryCoverage(database, job.chatId);
    if (
      coverage.some((interval) => interval.startAt <= job.startAt && interval.endAt >= job.endAt)
    ) {
      await completeBackfillJob(database, job, {
        chatId: job.chatId,
        endAt: job.endAt,
        startAt: job.startAt
      });
      continue;
    }

    try {
      emitHistoryEvent(options, 'history.job.started', {
        chatId: job.chatId,
        jobEnd: job.endAt.toISOString(),
        jobId: job.id,
        jobStart: job.startAt.toISOString()
      });
      const result = await executeBackfillJob(database, client, job, options);
      emitHistoryEvent(options, 'history.job.completed', {
        chatId: job.chatId,
        fetchedMessages: result.fetchedMessages,
        ...(result.historyStartAt === undefined ? {} : { historyStartAt: result.historyStartAt }),
        jobEnd: job.endAt.toISOString(),
        jobId: job.id,
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
      await resetBackfillJob(database, job);
      emitHistoryEvent(options, 'history.job.failed', {
        chatId: job.chatId,
        error: error instanceof Error ? error.message : String(error),
        jobEnd: job.endAt.toISOString(),
        jobId: job.id,
        jobStart: job.startAt.toISOString()
      });
      throw error;
    }
  }
}

async function executeBackfillJob(
  database: AppDatabase,
  client: TelegramHistoryClient,
  job: BackfillJob,
  options: Pick<HistorySyncOptions, 'messageLimit' | 'publishEvent' | 'requestDelayMs'>
): Promise<BackfillJobExecutionResult> {
  let remainingEndAt = job.endAt;
  let cursorMessageId = readCursorMessageId(job.cursor);
  let fetchedMessages = 0;
  let historyStartAt: Date | undefined;
  let storedMessages = 0;

  for (;;) {
    await delay(options.requestDelayMs);

    const page = await client.fetchPage({
      chatId: job.chatId,
      ...(cursorMessageId === undefined ? {} : { cursorMessageId }),
      endAt: remainingEndAt.toISOString(),
      limit: options.messageLimit,
      startAt: job.startAt.toISOString()
    });

    if (page.kind === 'no_messages_before_end') {
      await completeJobWithCoverage(database, job, options, {
        endAt: remainingEndAt,
        startAt: TELEGRAM_HISTORY_PAST_BOUNDARY
      });
      return {
        fetchedMessages,
        ...(historyStartAt === undefined ? {} : { historyStartAt: historyStartAt.toISOString() }),
        reachedBeginning: true,
        storedMessages
      };
    }

    if (page.kind === 'anchor_before_start') {
      await completeJobWithCoverage(database, job, options, {
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

    const nextCursor = page.nextCursorMessageId;
    const oldestFetchedMessageDate =
      page.oldestFetchedMessageDate === undefined
        ? undefined
        : new Date(page.oldestFetchedMessageDate);
    if (oldestFetchedMessageDate !== undefined) {
      historyStartAt = minDate(historyStartAt, oldestFetchedMessageDate);
    }
    const checkpoint = checkpointBackfillPage(job, {
      crossedStart: page.crossedStart,
      ...(oldestFetchedMessageDate === undefined ? {} : { oldestFetchedMessageDate }),
      reachedBeginning: page.reachedBeginning,
      remainingEndAt
    });
    await checkpointBackfillJob(database, job, {
      complete: checkpoint.complete,
      ...(checkpoint.coveredInterval === undefined
        ? {}
        : { coveredInterval: checkpoint.coveredInterval }),
      ...(checkpoint.complete || nextCursor === undefined
        ? {}
        : { cursor: { messageId: nextCursor } }),
      ...(checkpoint.complete ? {} : { remainingEndAt: checkpoint.remainingEndAt })
    });

    if (checkpoint.coveredInterval !== undefined) {
      emitCoverageChanged(options, checkpoint.coveredInterval);
    }

    if (nextCursor === undefined) {
      return {
        fetchedMessages,
        ...(page.reachedBeginning && historyStartAt !== undefined
          ? { historyStartAt: historyStartAt.toISOString() }
          : {}),
        reachedBeginning: page.reachedBeginning,
        storedMessages
      };
    }

    if (checkpoint.complete) {
      return {
        fetchedMessages,
        ...(page.reachedBeginning && historyStartAt !== undefined
          ? { historyStartAt: historyStartAt.toISOString() }
          : {}),
        reachedBeginning: page.reachedBeginning,
        storedMessages
      };
    }

    cursorMessageId = nextCursor;
    remainingEndAt = checkpoint.remainingEndAt;
    emitHistoryEvent(options, 'history.job.progress', {
      chatId: job.chatId,
      cursorMessageId,
      fetchedMessages,
      jobEnd: remainingEndAt.toISOString(),
      jobId: job.id,
      jobStart: job.startAt.toISOString(),
      storedMessages
    });
  }
}

async function completeJobWithCoverage(
  database: AppDatabase,
  job: BackfillJob,
  options: Pick<HistorySyncOptions, 'publishEvent'>,
  interval: {
    endAt: Date;
    startAt: Date;
  }
): Promise<void> {
  const coveredInterval = {
    chatId: job.chatId,
    endAt: interval.endAt,
    startAt: interval.startAt
  };
  await checkpointBackfillJob(database, job, {
    complete: true,
    coveredInterval
  });
  emitCoverageChanged(options, coveredInterval);
}

function emitCoverageChanged(
  options: Pick<HistorySyncOptions, 'publishEvent'>,
  interval: {
    chatId: string;
    endAt: Date;
    startAt: Date;
  }
): void {
  emitHistoryEvent(options, 'history.coverage.changed', historyCoverageChangedData([interval]));
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

function emitHistoryEvent(
  options: Pick<HistorySyncOptions, 'publishEvent'>,
  type: string,
  data: JsonObject
): void {
  options.publishEvent?.(
    createIntegrationEvent({
      data,
      source: 'history-sync',
      type
    })
  );
}

function truncateToTelegramSecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

function minDate(current: Date | undefined, next: Date): Date {
  return current === undefined || next < current ? next : current;
}

function readCursorMessageId(cursor: unknown): number | undefined {
  const record =
    typeof cursor === 'object' && cursor !== null ? (cursor as Record<string, unknown>) : undefined;
  return typeof record?.messageId === 'number' ? record.messageId : undefined;
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
