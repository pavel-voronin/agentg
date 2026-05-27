import { createTelegramHistoryCoverageChangedEvent } from './integrationEvents.js';

import { recordMessageFiles, storeMessage } from './telegram-store/message.js';
import {
  addTelegramHistoryCoverageBatch,
  listTelegramHistoryCoverage,
  normalizeCoverageWriteInput,
  orderTelegramHistoryIntervalsClosestToPresent,
  subtractTelegramHistoryIntervals,
  withTelegramHistoryCoverageLocks,
  writeTelegramHistoryCoverageInTransaction,
  type TelegramHistoryCoverageInterval
} from './telegramHistoryCoverage.js';
import { countTelegramMessagesInIntervals } from './telegramMessageCounts.js';
import {
  floorToTelegramSecond,
  normalizeTelegramHistoryInterval,
  TELEGRAM_HISTORY_PAST_BOUNDARY,
  TELEGRAM_HISTORY_TICK_MS,
  type TelegramHistoryInterval
} from './telegramHistoryTime.js';
import type {
  TelegramEnsureHistoryCoverageOutput,
  TelegramHistoryFetchPageRequest,
  TelegramHistoryFetchPageResult
} from './rpc/contracts.js';
import type { TelegramRpcRuntime } from './rpc/runtime.js';
import { parseLimit, requireDate } from './telegramProcedureInputs.js';
import { getChatHistory, getChatMessageByDate } from './telegramTdlibOperations.js';
import { telegramTdlibPriorities, type TelegramTdlibPriority } from './telegramTdlibPriority.js';
import {
  telegramWireDate,
  telegramWireIdNumber,
  type TelegramWireMessage
} from './telegramWire.js';

export type TelegramHistoryPageCheckpointInput = {
  crossedStart: boolean;
  oldestFetchedMessageDate?: Date;
  reachedBeginning: boolean;
  remainingEndAt: Date;
};

export type TelegramHistoryPageCheckpoint = {
  complete: boolean;
  coveredInterval?: TelegramHistoryCoverageInterval;
  remainingEndAt: Date;
};

type TelegramHistoryCoverageEventInterval = ReturnType<
  typeof normalizeCoverageWriteInput
>[number] & {
  messageCount: number;
};

const TELEGRAM_ENSURE_HISTORY_DEFAULT_MAX_PAGES = 1;
const TELEGRAM_ENSURE_HISTORY_MAX_PAGES = 100;
const TELEGRAM_ENSURE_HISTORY_DEFAULT_LIMIT = 100;
const TELEGRAM_ENSURE_HISTORY_MAX_LIMIT = 100;

export async function fetchTelegramHistoryPage(
  runtime: TelegramRpcRuntime,
  request: TelegramHistoryFetchPageRequest,
  options: { priority: TelegramTdlibPriority } = { priority: telegramTdlibPriorities.low }
): Promise<TelegramHistoryFetchPageResult> {
  const chatId = parseTelegramChatId(request.chatId);
  const startAt = requireDate(request.startAt, 'telegram.history.fetch_page requires startAt');
  const endAt = requireDate(request.endAt, 'telegram.history.fetch_page requires endAt');
  const limit = parseLimit(request.limit, TELEGRAM_ENSURE_HISTORY_DEFAULT_LIMIT, 100);
  let cursorMessageId = optionalTelegramMessageId(request.cursorMessageId);
  let remainingEndAt = endAt;

  if (cursorMessageId === undefined) {
    const anchor = await getLastMessageNoLaterThan(runtime, chatId, endAt, {
      priority: options.priority
    });
    const anchorDate = tdMessageDate(anchor);
    const anchorMessageId = tdMessageId(anchor);

    if (anchor === undefined || anchorMessageId === undefined) {
      const coveredInterval = await addAndPublishCoverage(runtime, {
        chatId: request.chatId,
        endAt,
        startAt: TELEGRAM_HISTORY_PAST_BOUNDARY
      });
      return {
        ...(coveredInterval === undefined ? {} : { coveredInterval }),
        fetchedMessages: 0,
        kind: 'no_messages_before_end',
        storedMessages: 0
      };
    }

    if (anchorDate !== undefined && anchorDate < startAt) {
      const coveredInterval = await addAndPublishCoverage(runtime, {
        chatId: request.chatId,
        endAt,
        startAt
      });
      return {
        anchorMessageDate: anchorDate.toISOString(),
        ...(coveredInterval === undefined ? {} : { coveredInterval }),
        fetchedMessages: 0,
        kind: 'anchor_before_start',
        storedMessages: 0
      };
    }

    if (anchorDate !== undefined && anchorDate < remainingEndAt) {
      remainingEndAt = nextTelegramSecond(anchorDate);
    }

    cursorMessageId = anchorMessageId;
  }

  const history = await getChatHistory(
    runtime,
    {
      _: 'getChatHistory',
      chat_id: chatId,
      from_message_id: cursorMessageId,
      limit,
      offset: 0,
      only_local: false
    },
    {
      priority: options.priority
    }
  );
  const concreteMessages = history.messages.filter(isFetchedMessage);

  if (concreteMessages.length === 0) {
    const coveredInterval = await addAndPublishCoverage(runtime, {
      chatId: request.chatId,
      endAt,
      startAt: TELEGRAM_HISTORY_PAST_BOUNDARY
    });
    return {
      ...(coveredInterval === undefined ? {} : { coveredInterval }),
      fetchedMessages: 0,
      kind: 'no_messages_before_end',
      storedMessages: 0
    };
  }

  const nextCursorMessageId = oldestMessageIdOlderThan(concreteMessages, cursorMessageId);
  const oldestFetchedMessageDate = oldestMessageDate(concreteMessages);
  const crossedStart = concreteMessages.some((message) => isBeforeInterval(message, startAt));
  const checkpoint = checkpointTelegramHistoryPage(
    {
      chatId: request.chatId,
      endAt,
      startAt,
      status: 'running'
    },
    {
      crossedStart,
      ...(oldestFetchedMessageDate === undefined ? {} : { oldestFetchedMessageDate }),
      reachedBeginning: nextCursorMessageId === undefined,
      remainingEndAt
    }
  );
  const persisted = await persistPageAndCoverage(runtime, {
    coveredInterval: checkpoint.coveredInterval,
    messages: concreteMessages,
    request: {
      chatId: request.chatId,
      endAt: remainingEndAt,
      startAt
    }
  });
  const coveredInterval =
    checkpoint.coveredInterval === undefined
      ? undefined
      : intervalToResponse(checkpoint.coveredInterval);

  if (persisted.coverageIntervals.length > 0) {
    runtime.eventBus.publish(
      createTelegramHistoryCoverageChangedEvent({
        intervals: persisted.coverageIntervals
      })
    );
  }

  return {
    ...(coveredInterval === undefined ? {} : { coveredInterval }),
    crossedStart,
    fetchedMessages: concreteMessages.length,
    kind: 'page',
    ...(nextCursorMessageId === undefined ? {} : { nextCursorMessageId }),
    ...(oldestFetchedMessageDate === undefined
      ? {}
      : { oldestFetchedMessageDate: oldestFetchedMessageDate.toISOString() }),
    reachedBeginning: nextCursorMessageId === undefined,
    storedMessages: persisted.storedMessages
  };
}

export async function ensureTelegramHistoryCoverage(
  runtime: TelegramRpcRuntime,
  request: {
    chatId: string;
    endAt: string;
    limit?: number | undefined;
    maxPages?: number | undefined;
    requestDelayMs?: number | undefined;
    startAt: string;
  }
): Promise<TelegramEnsureHistoryCoverageOutput> {
  const chatId = request.chatId;
  const requestedInterval = normalizeTelegramHistoryInterval({
    endAt: requireDate(request.endAt, 'telegram.history.ensure_coverage requires endAt'),
    startAt: requireDate(request.startAt, 'telegram.history.ensure_coverage requires startAt')
  });
  if (requestedInterval.startAt >= requestedInterval.endAt) {
    return {
      alreadyCovered: true,
      coveredIntervals: [],
      fetchedMessages: 0,
      pages: 0,
      remainingIntervals: [],
      reachedBeginning: false,
      storedMessages: 0
    };
  }

  const limit = parseLimit(
    request.limit,
    TELEGRAM_ENSURE_HISTORY_DEFAULT_LIMIT,
    TELEGRAM_ENSURE_HISTORY_MAX_LIMIT
  );
  const maxPages = parseLimit(
    request.maxPages,
    TELEGRAM_ENSURE_HISTORY_DEFAULT_MAX_PAGES,
    TELEGRAM_ENSURE_HISTORY_MAX_PAGES
  );
  const requestDelayMs = Math.max(0, request.requestDelayMs ?? 0);
  const initialMissing = await missingCoverageIntervals(runtime, chatId, [requestedInterval]);
  if (initialMissing.length === 0) {
    return {
      alreadyCovered: true,
      coveredIntervals: [],
      fetchedMessages: 0,
      pages: 0,
      remainingIntervals: [],
      reachedBeginning: false,
      storedMessages: 0
    };
  }

  let fetchedMessages = 0;
  let pages = 0;
  let reachedBeginning = false;
  let storedMessages = 0;
  const coveredIntervals: TelegramHistoryInterval[] = [];

  for (const interval of orderTelegramHistoryIntervalsClosestToPresent(initialMissing)) {
    let remainingEndAt = interval.endAt;
    let cursorMessageId: number | undefined;

    for (;;) {
      if (pages >= maxPages) {
        return {
          alreadyCovered: false,
          coveredIntervals: coveredIntervals.map(intervalToResponse),
          fetchedMessages,
          pages,
          remainingIntervals: (
            await missingCoverageIntervals(runtime, chatId, [requestedInterval])
          ).map(intervalToResponse),
          reachedBeginning,
          storedMessages
        };
      }

      await delay(requestDelayMs);
      const page = await fetchTelegramHistoryPage(
        runtime,
        {
          chatId,
          ...(cursorMessageId === undefined ? {} : { cursorMessageId }),
          endAt: remainingEndAt.toISOString(),
          limit,
          startAt: interval.startAt.toISOString()
        },
        { priority: telegramTdlibPriorities.low }
      );
      pages += 1;

      if (page.coveredInterval !== undefined) {
        coveredIntervals.push({
          endAt: new Date(page.coveredInterval.endAt),
          startAt: new Date(page.coveredInterval.startAt)
        });
      }

      fetchedMessages += page.fetchedMessages;
      storedMessages += page.storedMessages;

      if (page.kind === 'no_messages_before_end' || page.kind === 'anchor_before_start') {
        reachedBeginning ||= page.kind === 'no_messages_before_end';
        break;
      }

      reachedBeginning ||= page.reachedBeginning;
      if (page.reachedBeginning || page.crossedStart || page.nextCursorMessageId === undefined) {
        break;
      }

      cursorMessageId = page.nextCursorMessageId;
      remainingEndAt =
        page.coveredInterval === undefined
          ? new Date(page.oldestFetchedMessageDate ?? remainingEndAt)
          : new Date(page.coveredInterval.startAt);
    }
  }

  const remainingIntervals = await missingCoverageIntervals(runtime, chatId, [requestedInterval]);

  return {
    alreadyCovered: false,
    coveredIntervals: coveredIntervals.map(intervalToResponse),
    fetchedMessages,
    pages,
    remainingIntervals: remainingIntervals.map(intervalToResponse),
    reachedBeginning,
    storedMessages
  };
}

export function checkpointTelegramHistoryPage(
  job: {
    chatId: string;
    endAt: Date;
    startAt: Date;
    status: 'running';
  },
  checkpoint: TelegramHistoryPageCheckpointInput
): TelegramHistoryPageCheckpoint {
  const remainingEndAt = normalizeTelegramHistoryInterval({
    endAt: checkpoint.remainingEndAt,
    startAt: job.startAt
  }).endAt;
  const coveredStartAt = checkpointCoveredStartAt(job, checkpoint, remainingEndAt);
  const coveredInterval =
    coveredStartAt === undefined || coveredStartAt >= remainingEndAt
      ? undefined
      : {
          chatId: job.chatId,
          endAt: remainingEndAt,
          startAt: coveredStartAt
        };

  return {
    complete: checkpoint.crossedStart || checkpoint.reachedBeginning,
    ...(coveredInterval === undefined ? {} : { coveredInterval }),
    remainingEndAt:
      coveredInterval === undefined || checkpoint.crossedStart || checkpoint.reachedBeginning
        ? remainingEndAt
        : coveredInterval.startAt
  };
}

async function persistPageAndCoverage(
  runtime: TelegramRpcRuntime,
  input: {
    coveredInterval: TelegramHistoryCoverageInterval | undefined;
    messages: TelegramWireMessage[];
    request: {
      chatId: string;
      endAt: Date;
      startAt: Date;
    };
  }
): Promise<{
  coverageIntervals: TelegramHistoryCoverageEventInterval[];
  storedMessages: number;
}> {
  const provedAt = new Date();
  const coverageIntervals =
    input.coveredInterval === undefined
      ? []
      : normalizeCoverageWriteInput([input.coveredInterval], provedAt);
  const messages = input.messages.filter((message) => {
    const messageDate = tdMessageDate(message);
    return (
      messageDate !== undefined &&
      messageDate >= input.request.startAt &&
      messageDate < input.request.endAt
    );
  });

  let storedMessages = 0;
  await withTelegramHistoryCoverageLocks([input.request.chatId], async () =>
    runtime.database.transaction(async (transaction) => {
      for (const message of messages) {
        const stored = await storeMessage(transaction, message);
        if (stored) {
          storedMessages += 1;
        }
      }

      if (coverageIntervals.length > 0) {
        await writeTelegramHistoryCoverageInTransaction(transaction, coverageIntervals);
      }
    })
  );

  for (const message of messages) {
    await recordMessageFiles(runtime.files, message, 'history_fetch');
  }

  return {
    coverageIntervals: await addCoverageMessageCounts(runtime, coverageIntervals),
    storedMessages
  };
}

async function addAndPublishCoverage(
  runtime: TelegramRpcRuntime,
  interval: TelegramHistoryCoverageInterval
): Promise<{ endAt: string; startAt: string } | undefined> {
  const result = await addTelegramHistoryCoverageBatch(runtime.database, [interval]);
  if (result.intervals.length === 0) {
    return undefined;
  }

  const intervals = await addCoverageMessageCounts(runtime, result.intervals);
  runtime.eventBus.publish(
    createTelegramHistoryCoverageChangedEvent({
      intervals
    })
  );

  const writtenInterval = result.intervals[0];
  return writtenInterval === undefined ? undefined : intervalToResponse(writtenInterval);
}

async function addCoverageMessageCounts(
  runtime: TelegramRpcRuntime,
  intervals: ReturnType<typeof normalizeCoverageWriteInput>
): Promise<TelegramHistoryCoverageEventInterval[]> {
  const counts =
    intervals.length === 0
      ? []
      : await countTelegramMessagesInIntervals(runtime.database, intervals);
  return intervals.map((interval, index) => ({
    ...interval,
    messageCount: counts[index] ?? 0
  }));
}

async function missingCoverageIntervals(
  runtime: TelegramRpcRuntime,
  chatId: string,
  requestedIntervals: TelegramHistoryInterval[]
): Promise<TelegramHistoryInterval[]> {
  const coverage = await listTelegramHistoryCoverage(runtime.database, chatId);
  return subtractTelegramHistoryIntervals(requestedIntervals, coverage);
}

function checkpointCoveredStartAt(
  job: { startAt: Date },
  checkpoint: TelegramHistoryPageCheckpointInput,
  remainingEndAt: Date
): Date | undefined {
  if (checkpoint.reachedBeginning) {
    return TELEGRAM_HISTORY_PAST_BOUNDARY;
  }

  if (checkpoint.crossedStart) {
    return job.startAt;
  }

  if (checkpoint.oldestFetchedMessageDate === undefined) {
    return undefined;
  }

  const oldestFetchedSecond = floorToTelegramSecond(checkpoint.oldestFetchedMessageDate);
  const nextUnprovenEndAt = new Date(oldestFetchedSecond.getTime() + TELEGRAM_HISTORY_TICK_MS);
  return nextUnprovenEndAt < remainingEndAt ? nextUnprovenEndAt : undefined;
}

function nextTelegramSecond(date: Date): Date {
  const second = floorToTelegramSecond(date);
  return new Date(second.getTime() + TELEGRAM_HISTORY_TICK_MS);
}

function intervalToResponse(interval: TelegramHistoryInterval): { endAt: string; startAt: string } {
  const normalized = normalizeTelegramHistoryInterval(interval);
  return {
    endAt: normalized.endAt.toISOString(),
    startAt: normalized.startAt.toISOString()
  };
}

function isFetchedMessage(value: TelegramWireMessage | null): value is TelegramWireMessage {
  return value !== null;
}

async function getLastMessageNoLaterThan(
  runtime: TelegramRpcRuntime,
  chatId: number,
  end: Date,
  options: { priority: TelegramTdlibPriority }
): Promise<TelegramWireMessage | undefined> {
  try {
    return await getChatMessageByDate(
      runtime,
      {
        _: 'getChatMessageByDate',
        chat_id: chatId,
        date: Math.floor((end.getTime() - 1) / 1000)
      },
      options
    );
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

function parseTelegramChatId(value: string): number {
  const text = value.trim();
  const parsed = Number(text);
  if (text.length === 0 || !Number.isSafeInteger(parsed)) {
    throw new Error(`Telegram chat id must be numeric: ${text}`);
  }
  return parsed;
}

function optionalTelegramMessageId(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(`Telegram message id must be numeric: ${String(value)}`);
  }
  return value;
}

function tdMessageId(message: TelegramWireMessage | undefined): number | undefined {
  return telegramWireIdNumber(message?.id);
}

function tdMessageDate(message: TelegramWireMessage | undefined): Date | undefined {
  return telegramWireDate(message?.date);
}

function isBeforeInterval(message: TelegramWireMessage, startAt: Date): boolean {
  const messageDate = tdMessageDate(message);
  return messageDate !== undefined && messageDate < startAt;
}

function oldestMessageDate(messages: TelegramWireMessage[]): Date | undefined {
  const dates = messages.map(tdMessageDate).filter((date): date is Date => date !== undefined);
  const [first, ...rest] = dates;
  return first === undefined
    ? undefined
    : rest.reduce((oldest, date) => (date < oldest ? date : oldest), first);
}

function oldestMessageIdOlderThan(
  messages: TelegramWireMessage[],
  cursorMessageId: number
): number | undefined {
  const ids = messages
    .map(tdMessageId)
    .filter((id): id is number => id !== undefined && id < cursorMessageId);

  return ids.length === 0 ? undefined : Math.min(...ids);
}

function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
