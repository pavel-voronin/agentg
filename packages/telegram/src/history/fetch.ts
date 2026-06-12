import { parseLimit, type EventBus } from '@agentg/framework';
import type { message as Message } from 'tdlib-types';

import type { Database } from '../database/client.js';
import type { FileSubsystem } from '../files/index.js';
import { chatRef } from '../model/refs.js';
import { recordMessageFiles, storeMessage } from '../store/message.js';
import type { Operations } from '../tdlib/operations.js';
import {
  addHistoryCoverageBatch,
  listHistoryCoverage,
  normalizeCoverageWriteInput,
  orderHistoryIntervalsClosestToPresent,
  subtractHistoryIntervals,
  withHistoryCoverageLocks,
  writeHistoryCoverageInTransaction,
  type HistoryCoverageInterval
} from './coverage.js';
import { countMessagesInIntervals } from './messageCounts.js';
import {
  floorToHistorySecond,
  normalizeHistoryInterval,
  requireDate,
  HISTORY_PAST_BOUNDARY,
  HISTORY_TICK_MS,
  type HistoryInterval
} from './time.js';
import { priorities, type Priority } from '../tdlib/priority.js';
import { tdDate, tdIdNumber } from '../tdlib/value.js';
import { messagesNeedingFileRecording } from './fileRecording.js';

// TODO(file-size): Split page fetch, ensure coverage orchestration, and persistence helpers.
export type FetchPageInput = {
  chatId: string;
  cursorMessageId?: number | undefined;
  endAt: string;
  limit: number;
  startAt: string;
};

export type FetchPageResult =
  | {
      coveredInterval?: { endAt: string; startAt: string } | undefined;
      fetchedMessages: 0;
      kind: 'no_messages_before_end';
      storedMessages: 0;
    }
  | {
      anchorMessageDate: string;
      coveredInterval?: { endAt: string; startAt: string } | undefined;
      fetchedMessages: 0;
      kind: 'anchor_before_start';
      storedMessages: 0;
    }
  | {
      coveredInterval?: { endAt: string; startAt: string } | undefined;
      crossedStart: boolean;
      fetchedMessages: number;
      kind: 'page';
      nextCursorMessageId?: number | undefined;
      oldestFetchedMessageDate?: string | undefined;
      reachedBeginning: boolean;
      storedMessages: number;
    };

export type EnsureCoverageInput = {
  chatId: string;
  endAt: string;
  limit?: number | undefined;
  maxPages?: number | undefined;
  requestDelayMs?: number | undefined;
  startAt: string;
};

export type EnsureCoverageOutput = {
  alreadyCovered: boolean;
  coveredIntervals: { endAt: string; startAt: string }[];
  fetchedMessages: number;
  pages: number;
  remainingIntervals: { endAt: string; startAt: string }[];
  reachedBeginning: boolean;
  storedMessages: number;
};

export type HistoryResources = {
  database: Database;
  events: EventBus;
  files: FileSubsystem;
  tdlib: Operations;
};

export type HistoryPageCheckpointInput = {
  crossedStart: boolean;
  oldestFetchedMessageDate?: Date;
  reachedBeginning: boolean;
  remainingEndAt: Date;
};

export type HistoryPageCheckpoint = {
  complete: boolean;
  coveredInterval?: HistoryCoverageInterval;
  remainingEndAt: Date;
};

type HistoryCoverageEventInterval = ReturnType<typeof normalizeCoverageWriteInput>[number] & {
  messageCount: number;
};

const TELEGRAM_ENSURE_HISTORY_DEFAULT_MAX_PAGES = 1;
const TELEGRAM_ENSURE_HISTORY_MAX_PAGES = 100;
const TELEGRAM_ENSURE_HISTORY_DEFAULT_LIMIT = 100;
const TELEGRAM_ENSURE_HISTORY_MAX_LIMIT = 100;

export async function fetchHistoryPage(
  request: FetchPageInput,
  resources: HistoryResources,
  options: { priority: Priority } = { priority: priorities.low }
): Promise<FetchPageResult> {
  const chatId = parseChatId(request.chatId);
  const startAt = requireDate(request.startAt, 'telegram.history.fetch_page requires startAt');
  const endAt = requireDate(request.endAt, 'telegram.history.fetch_page requires endAt');
  const limit = parseLimit(request.limit, TELEGRAM_ENSURE_HISTORY_DEFAULT_LIMIT, 100);
  let cursorMessageId = optionalMessageId(request.cursorMessageId);
  const remainingEndAt = endAt;

  if (cursorMessageId === undefined) {
    const anchor = await getLastMessageNoLaterThan(chatId, endAt, resources, {
      priority: options.priority
    });
    const anchorDate = tdMessageDate(anchor);
    const anchorMessageId = tdMessageId(anchor);

    if (anchor === undefined || anchorMessageId === undefined) {
      const coveredInterval = await addAndPublishCoverage(
        {
          chatId: request.chatId,
          endAt,
          startAt: HISTORY_PAST_BOUNDARY
        },
        resources
      );
      return {
        ...(coveredInterval === undefined ? {} : { coveredInterval }),
        fetchedMessages: 0,
        kind: 'no_messages_before_end',
        storedMessages: 0
      };
    }

    if (anchorDate !== undefined && anchorDate < startAt) {
      const coveredInterval = await addAndPublishCoverage(
        {
          chatId: request.chatId,
          endAt,
          startAt
        },
        resources
      );
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

  const history = await resources.tdlib.getChatHistory(
    {
      chatId,
      fromMessageId: cursorMessageId,
      limit,
      offset: 0,
      onlyLocal: false
    },
    {
      priority: options.priority
    }
  );
  const concreteMessages = history.messages.filter(isFetchedMessage);

  if (concreteMessages.length === 0) {
    const coveredInterval = await addAndPublishCoverage(
      {
        chatId: request.chatId,
        endAt,
        startAt: HISTORY_PAST_BOUNDARY
      },
      resources
    );
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
  const checkpoint = checkpointHistoryPage(
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
  const persisted = await persistPageAndCoverage(
    {
      coveredInterval: checkpoint.coveredInterval,
      messages: concreteMessages,
      request: {
        chatId: request.chatId,
        endAt: remainingEndAt,
        startAt
      }
    },
    resources
  );
  const coveredInterval =
    checkpoint.coveredInterval === undefined
      ? undefined
      : intervalToResponse(checkpoint.coveredInterval);

  if (persisted.coverageIntervals.length > 0) {
    publishCoverageChanged(resources.events, persisted.coverageIntervals);
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

export async function ensureHistoryCoverage(
  request: EnsureCoverageInput,
  resources: HistoryResources
): Promise<EnsureCoverageOutput> {
  const chatId = request.chatId;
  const requestedInterval = normalizeHistoryInterval({
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
  const initialMissing = await missingCoverageIntervals(chatId, [requestedInterval], resources);
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
  const coveredIntervals: HistoryInterval[] = [];

  for (const interval of orderHistoryIntervalsClosestToPresent(initialMissing)) {
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
            await missingCoverageIntervals(chatId, [requestedInterval], resources)
          ).map(intervalToResponse),
          reachedBeginning,
          storedMessages
        };
      }

      await delay(requestDelayMs);
      const page = await fetchHistoryPage(
        {
          chatId,
          ...(cursorMessageId === undefined ? {} : { cursorMessageId }),
          endAt: remainingEndAt.toISOString(),
          limit,
          startAt: interval.startAt.toISOString()
        },
        resources,
        { priority: priorities.low }
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

  const remainingIntervals = await missingCoverageIntervals(chatId, [requestedInterval], resources);

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

export function checkpointHistoryPage(
  job: {
    chatId: string;
    endAt: Date;
    startAt: Date;
    status: 'running';
  },
  checkpoint: HistoryPageCheckpointInput
): HistoryPageCheckpoint {
  const remainingEndAt = normalizeHistoryInterval({
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
  input: {
    coveredInterval: HistoryCoverageInterval | undefined;
    messages: Message[];
    request: {
      chatId: string;
      endAt: Date;
      startAt: Date;
    };
  },
  resources: HistoryResources
): Promise<{
  coverageIntervals: HistoryCoverageEventInterval[];
  storedMessages: number;
}> {
  const { database } = resources;
  const { files } = resources;
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
  const messagesForFileRecording = await messagesNeedingFileRecording(database, messages);

  let storedMessages = 0;
  await withHistoryCoverageLocks([input.request.chatId], async () =>
    database.transaction(async (transaction) => {
      for (const message of messages) {
        const stored = await storeMessage(transaction, message);
        if (stored) {
          storedMessages += 1;
        }
      }

      if (coverageIntervals.length > 0) {
        await writeHistoryCoverageInTransaction(transaction, coverageIntervals);
      }
    })
  );

  for (const message of messagesForFileRecording) {
    await recordMessageFiles(files, message, 'history_fetch');
  }

  return {
    coverageIntervals: await addCoverageMessageCounts(coverageIntervals, resources),
    storedMessages
  };
}

async function addAndPublishCoverage(
  interval: HistoryCoverageInterval,
  resources: HistoryResources
): Promise<{ endAt: string; startAt: string } | undefined> {
  const { database } = resources;
  const result = await addHistoryCoverageBatch(database, [interval]);
  if (result.intervals.length === 0) {
    return undefined;
  }

  const intervals = await addCoverageMessageCounts(result.intervals, resources);
  publishCoverageChanged(resources.events, intervals);

  const writtenInterval = result.intervals[0];
  return writtenInterval === undefined ? undefined : intervalToResponse(writtenInterval);
}

async function addCoverageMessageCounts(
  intervals: ReturnType<typeof normalizeCoverageWriteInput>,
  resources: HistoryResources
): Promise<HistoryCoverageEventInterval[]> {
  const { database } = resources;
  const counts = intervals.length === 0 ? [] : await countMessagesInIntervals(database, intervals);
  return intervals.map((interval, index) => ({
    ...interval,
    messageCount: counts[index] ?? 0
  }));
}

async function missingCoverageIntervals(
  chatId: string,
  requestedIntervals: HistoryInterval[],
  resources: HistoryResources
): Promise<HistoryInterval[]> {
  const coverage = await listHistoryCoverage(resources.database, chatId);
  return subtractHistoryIntervals(requestedIntervals, coverage);
}

function checkpointCoveredStartAt(
  job: { startAt: Date },
  checkpoint: HistoryPageCheckpointInput,
  remainingEndAt: Date
): Date | undefined {
  if (checkpoint.reachedBeginning) {
    return HISTORY_PAST_BOUNDARY;
  }

  if (checkpoint.crossedStart) {
    return job.startAt;
  }

  if (checkpoint.oldestFetchedMessageDate === undefined) {
    return undefined;
  }

  const oldestFetchedSecond = floorToHistorySecond(checkpoint.oldestFetchedMessageDate);
  const nextUnprovenEndAt = new Date(oldestFetchedSecond.getTime() + HISTORY_TICK_MS);
  return nextUnprovenEndAt < remainingEndAt ? nextUnprovenEndAt : undefined;
}

function intervalToResponse(interval: HistoryInterval): { endAt: string; startAt: string } {
  const normalized = normalizeHistoryInterval(interval);
  return {
    endAt: normalized.endAt.toISOString(),
    startAt: normalized.startAt.toISOString()
  };
}

function publishCoverageChanged(events: EventBus, intervals: HistoryCoverageEventInterval[]): void {
  if (intervals.length === 0) {
    return;
  }
  const serializedIntervals = intervals.map((interval) => ({
    chat: chatRef(interval.chatId),
    endAt: interval.endAt.toISOString(),
    messageCount: interval.messageCount,
    provedAt: interval.provedAt.toISOString(),
    startAt: interval.startAt.toISOString()
  }));
  events.publish('telegram.history.coverage.changed', {
    chatCount: new Set(serializedIntervals.map((interval) => interval.chat.id)).size,
    endAt: maxIso(serializedIntervals.map((interval) => interval.endAt)),
    intervals: serializedIntervals,
    startAt: minIso(serializedIntervals.map((interval) => interval.startAt))
  });
}

function minIso(values: string[]): string {
  const first = values[0];
  if (first === undefined) {
    throw new Error('history coverage event requires at least one interval');
  }
  return values.slice(1).reduce((minimum, value) => (value < minimum ? value : minimum), first);
}

function maxIso(values: string[]): string {
  const first = values[0];
  if (first === undefined) {
    throw new Error('history coverage event requires at least one interval');
  }
  return values.slice(1).reduce((maximum, value) => (value > maximum ? value : maximum), first);
}

function isFetchedMessage(value: Message | null): value is Message {
  return value !== null;
}

async function getLastMessageNoLaterThan(
  chatId: number,
  end: Date,
  resources: HistoryResources,
  options: { priority: Priority }
): Promise<Message | undefined> {
  try {
    return await resources.tdlib.getChatMessageByDate(
      {
        chatId,
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

function parseChatId(value: string): number {
  const text = value.trim();
  const parsed = Number(text);
  if (text.length === 0 || !Number.isSafeInteger(parsed)) {
    throw new Error(`Telegram chat id must be numeric: ${text}`);
  }
  return parsed;
}

function optionalMessageId(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(`Telegram message id must be numeric: ${String(value)}`);
  }
  return value;
}

function tdMessageId(message: Message | undefined): number | undefined {
  return tdIdNumber(message?.id);
}

function tdMessageDate(message: Message | undefined): Date | undefined {
  return tdDate(message?.date);
}

function isBeforeInterval(message: Message, startAt: Date): boolean {
  const messageDate = tdMessageDate(message);
  return messageDate !== undefined && messageDate < startAt;
}

function oldestMessageDate(messages: Message[]): Date | undefined {
  const dates = messages.map(tdMessageDate).filter((date): date is Date => date !== undefined);
  const [first, ...rest] = dates;
  return first === undefined
    ? undefined
    : rest.reduce((oldest, date) => (date < oldest ? date : oldest), first);
}

function oldestMessageIdOlderThan(
  messages: Message[],
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
