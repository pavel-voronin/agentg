import { createTelegramHistoryCoverageChangedEvent } from './integration-events.js';
import {
  asTdObject,
  normalizeHistoricalMessage,
  type NormalizedTelegramUpdate
} from './normalize.js';
import { persistTelegramUpdate } from './store.js';
import {
  addTelegramHistoryCoverageBatch,
  listTelegramHistoryCoverage,
  normalizeCoverageWriteInput,
  orderTelegramHistoryIntervalsClosestToPresent,
  subtractTelegramHistoryIntervals,
  withTelegramHistoryCoverageLocks,
  writeTelegramHistoryCoverageInTransaction,
  type TelegramHistoryCoverageInterval
} from './telegram-history-coverage.js';
import { countTelegramMessagesInIntervals } from './telegram-message-counts.js';
import {
  floorToTelegramSecond,
  normalizeTelegramHistoryInterval,
  TELEGRAM_HISTORY_PAST_BOUNDARY,
  TELEGRAM_HISTORY_TICK_MS,
  type TelegramHistoryInterval
} from './telegram-history-time.js';
import type {
  TelegramEnsureHistoryCoverageOutput,
  TelegramHistoryFetchPageRequest,
  TelegramHistoryFetchPageResult
} from './rpc/contracts.js';
import type { TelegramRpcRuntime } from './rpc/runtime.js';
import {
  getLastMessageNoLaterThan,
  invokeTdlib,
  isBeforeInterval,
  isTdObject,
  oldestMessageDate,
  oldestMessageIdOlderThan,
  optionalTelegramMessageId,
  parseLimit,
  parseTelegramChatId,
  requireDate,
  tdMessageDate,
  tdMessageId
} from './rpc/procedures/support.js';

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
  options: { priority: 'p2' | 'p4' } = { priority: 'p4' }
): Promise<TelegramHistoryFetchPageResult> {
  const chatId = parseTelegramChatId(request.chatId);
  const startAt = requireDate(request.startAt, 'telegram.history.fetch_page requires startAt');
  const endAt = requireDate(request.endAt, 'telegram.history.fetch_page requires endAt');
  const limit = parseLimit(request.limit, TELEGRAM_ENSURE_HISTORY_DEFAULT_LIMIT, 100);
  let cursorMessageId = optionalTelegramMessageId(request.cursorMessageId);

  if (cursorMessageId === undefined) {
    const anchor = await getLastMessageNoLaterThan(
      runtime.client,
      runtime.eventBus,
      chatId,
      endAt,
      {
        priority: options.priority
      }
    );
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

    cursorMessageId = anchorMessageId;
  }

  const history = asTdObject(
    await invokeTdlib(
      runtime.eventBus,
      runtime.client,
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
    )
  );
  const messages = Array.isArray(history?.messages) ? history.messages.map(asTdObject) : [];
  const concreteMessages = messages.filter(isTdObject);

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
      remainingEndAt: endAt
    }
  );
  const persisted = await persistPageAndCoverage(runtime, {
    coveredInterval: checkpoint.coveredInterval,
    messages: concreteMessages,
    request: {
      chatId: request.chatId,
      endAt,
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
        { priority: 'p4' }
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
    messages: unknown[];
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
  const normalizedMessages = input.messages.map(normalizeHistoricalMessage).filter(
    (
      message
    ): message is NormalizedTelegramUpdate & {
      message: NonNullable<NormalizedTelegramUpdate['message']>;
    } => {
      const messageDate = message?.message?.messageDate;
      return (
        message?.message !== undefined &&
        messageDate !== undefined &&
        messageDate >= input.request.startAt &&
        messageDate < input.request.endAt
      );
    }
  );

  let storedMessages = 0;
  await withTelegramHistoryCoverageLocks([input.request.chatId], async () =>
    runtime.database.transaction(async (transaction) => {
      for (const normalized of normalizedMessages) {
        const result = await persistTelegramUpdateInTransaction(transaction, normalized);
        if (result) {
          storedMessages += 1;
        }
      }

      if (coverageIntervals.length > 0) {
        await writeTelegramHistoryCoverageInTransaction(transaction, coverageIntervals);
      }
    })
  );

  for (const normalized of normalizedMessages) {
    runtime.fileIndexer.enqueue(normalized, 'history_fetch');
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

async function persistTelegramUpdateInTransaction(
  database: TelegramRpcRuntime['database'],
  update: Parameters<typeof persistTelegramUpdate>[1]
): Promise<boolean> {
  const result = await persistTelegramUpdate(database, update);
  return result.message;
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

function intervalToResponse(interval: TelegramHistoryInterval): { endAt: string; startAt: string } {
  const normalized = normalizeTelegramHistoryInterval(interval);
  return {
    endAt: normalized.endAt.toISOString(),
    startAt: normalized.startAt.toISOString()
  };
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
