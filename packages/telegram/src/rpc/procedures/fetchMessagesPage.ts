import { mutation } from '@agentg/rpc/surface';
import { and, eq, inArray } from 'drizzle-orm';

import { createTelegramHistoryCoverageChangedEvent } from '../../integration-events.js';
import {
  asTdObject,
  normalizeHistoricalMessage,
  type NormalizedTelegramUpdate,
  type TdObject
} from '../../normalize.js';
import { telegramMessages } from '../../schema.js';
import { persistTelegramUpdate } from '../../store.js';
import {
  normalizeCoverageWriteInput,
  withTelegramHistoryCoverageLocks,
  writeTelegramHistoryCoverageInTransaction,
  type TelegramHistoryCoverageInterval,
  type TelegramHistoryCoverageWriteSegment
} from '../../telegram-history-coverage.js';
import { countTelegramMessagesInIntervals } from '../../telegram-message-counts.js';
import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../../telegram-history-time.js';
import {
  telegramFetchMessagesPageInputSchema,
  telegramFetchMessagesPageOutputSchema,
  type TelegramReadMessage
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import {
  getLastMessageNoLaterThan,
  invokeTdlib,
  isTdObject,
  oldestMessageDate,
  oldestMessageIdOlderThan,
  parseLimit,
  parseTelegramChatId,
  readMessageSelection,
  tdMessageId,
  toReadMessages
} from './support.js';

const TELEGRAM_MESSAGE_PAGE_LIMIT = 100;
const TELEGRAM_MESSAGE_PAGE_MAX_LIMIT = 100;
const TELEGRAM_SECOND_MS = 1000;

type TelegramHistoryCoverageEventInterval = TelegramHistoryCoverageWriteSegment & {
  messageCount: number;
};

export const fetchMessagesPage = mutation((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramFetchMessagesPageInputSchema)
    .output(telegramFetchMessagesPageOutputSchema)
    .mutation(async ({ input }) => {
      const limit = parseLimit(
        input.limit,
        TELEGRAM_MESSAGE_PAGE_LIMIT,
        TELEGRAM_MESSAGE_PAGE_MAX_LIMIT
      );
      const chatId = parseTelegramChatId(input.chatId);
      const cursorMessageId = parseOptionalMessageId(input.beforeMessageId);
      const pageEndAt =
        cursorMessageId === undefined
          ? ceilToTelegramSecond(new Date())
          : await readMessagePageEndAt(runtime, input.chatId, input.beforeMessageId);
      const anchorMessageId =
        cursorMessageId ?? (await readLatestMessageId(runtime, chatId, pageEndAt ?? new Date()));

      if (anchorMessageId === undefined) {
        await addPageCoverage(runtime, {
          chatId: input.chatId,
          endAt: pageEndAt,
          startAt: TELEGRAM_HISTORY_PAST_BOUNDARY
        });
        return {
          messages: [],
          reachedStart: true
        };
      }

      const history = asTdObject(
        await invokeTdlib(
          runtime.eventBus,
          runtime.client,
          {
            _: 'getChatHistory',
            chat_id: chatId,
            from_message_id: anchorMessageId,
            limit,
            offset: 0,
            only_local: false
          },
          {
            priority: 'p2'
          }
        )
      );
      const fetchedMessages = Array.isArray(history?.messages)
        ? history.messages.map(asTdObject).filter(isTdObject)
        : [];
      const pageMessages =
        cursorMessageId === undefined
          ? fetchedMessages
          : fetchedMessages.filter((message) => isOlderThanCursor(message, cursorMessageId));
      const nextCursorMessageId = oldestMessageIdOlderThan(fetchedMessages, anchorMessageId);
      const reachedStart = nextCursorMessageId === undefined;
      const observedStartAt = observedIntervalStartAt(pageMessages, reachedStart);
      const persisted = await persistMessagesAndCoverage(runtime, {
        coverage:
          pageEndAt === undefined || observedStartAt === undefined
            ? undefined
            : {
                chatId: input.chatId,
                endAt: pageEndAt,
                startAt: observedStartAt ?? TELEGRAM_HISTORY_PAST_BOUNDARY
              },
        messages: pageMessages
      });
      const messages = await readPersistedMessages(runtime, input.chatId, persisted.messageIds);

      return {
        messages,
        reachedStart
      };
    })
);

async function readLatestMessageId(
  runtime: TelegramRpcRuntime,
  chatId: number,
  pageEndAt: Date
): Promise<number | undefined> {
  const anchor = await getLastMessageNoLaterThan(
    runtime.client,
    runtime.eventBus,
    chatId,
    pageEndAt,
    {
      priority: 'p2'
    }
  );
  return tdMessageId(anchor);
}

async function readMessagePageEndAt(
  runtime: TelegramRpcRuntime,
  chatId: string,
  messageId: string | undefined
): Promise<Date | undefined> {
  if (messageId === undefined) {
    return undefined;
  }

  const [message] = await runtime.database
    .select({
      messageDate: telegramMessages.messageDate
    })
    .from(telegramMessages)
    .where(
      and(
        eq(telegramMessages.telegramChatId, chatId),
        eq(telegramMessages.telegramMessageId, messageId)
      )
    )
    .limit(1);

  return message?.messageDate === null || message?.messageDate === undefined
    ? undefined
    : nextTelegramSecond(message.messageDate);
}

async function persistMessagesAndCoverage(
  runtime: TelegramRpcRuntime,
  input: {
    coverage: TelegramHistoryCoverageInterval | undefined;
    messages: TdObject[];
  }
): Promise<{ coverageIntervals: TelegramHistoryCoverageEventInterval[]; messageIds: string[] }> {
  const coverageIntervals =
    input.coverage === undefined ? [] : normalizeCoverageWriteInput([input.coverage], new Date());
  const messageIds: string[] = [];
  const normalizedMessages = input.messages.map(normalizeHistoricalMessage).filter(
    (
      update
    ): update is NormalizedTelegramUpdate & {
      message: NonNullable<NormalizedTelegramUpdate['message']>;
    } => update?.message !== undefined
  );

  await withTelegramHistoryCoverageLocks(
    input.coverage === undefined ? [] : [input.coverage.chatId],
    async () =>
      runtime.database.transaction(async (transaction) => {
        for (const normalized of normalizedMessages) {
          const result = await persistTelegramUpdate(transaction, normalized);
          if (result.message) {
            messageIds.push(normalized.message.messageId);
          }
        }

        if (coverageIntervals.length > 0) {
          await writeTelegramHistoryCoverageInTransaction(transaction, coverageIntervals);
        }
      })
  );

  for (const normalized of normalizedMessages) {
    runtime.fileIndexer.enqueue(normalized, 'operator_page');
  }
  const coverageEventIntervals = await addCoverageMessageCounts(runtime, coverageIntervals);
  if (coverageIntervals.length > 0) {
    runtime.eventBus.publish(
      createTelegramHistoryCoverageChangedEvent({
        intervals: coverageEventIntervals
      })
    );
  }

  return { coverageIntervals: coverageEventIntervals, messageIds };
}

async function addCoverageMessageCounts(
  runtime: TelegramRpcRuntime,
  intervals: TelegramHistoryCoverageWriteSegment[]
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

async function addPageCoverage(
  runtime: TelegramRpcRuntime,
  interval: {
    chatId: string;
    endAt: Date | undefined;
    startAt: Date;
  }
): Promise<void> {
  if (interval.endAt === undefined || interval.startAt >= interval.endAt) {
    return;
  }

  await persistMessagesAndCoverage(runtime, {
    coverage: {
      chatId: interval.chatId,
      endAt: interval.endAt,
      startAt: interval.startAt
    },
    messages: []
  });
}

async function readPersistedMessages(
  runtime: TelegramRpcRuntime,
  chatId: string,
  messageIds: string[]
): Promise<TelegramReadMessage[]> {
  const orderedMessageIds = [...new Set(messageIds)];
  if (orderedMessageIds.length === 0) {
    return [];
  }

  const rows = await runtime.database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(
      and(
        eq(telegramMessages.telegramChatId, chatId),
        inArray(telegramMessages.telegramMessageId, orderedMessageIds)
      )
    );
  const rowsById = new Map(rows.map((row) => [row.telegramMessageId, row]));
  const orderedRows = orderedMessageIds
    .map((messageId) => rowsById.get(messageId))
    .filter(isDefined);

  return toReadMessages(runtime.database, orderedRows);
}

function observedIntervalStartAt(
  messages: TdObject[],
  reachedStart: boolean
): Date | null | undefined {
  if (reachedStart) {
    return null;
  }

  const oldest = oldestMessageDate(messages);
  return oldest === undefined ? undefined : nextTelegramSecond(oldest);
}

function parseOptionalMessageId(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Telegram message id must be numeric: ${value}`);
  }
  return parsed;
}

function isOlderThanCursor(message: TdObject, cursorMessageId: number): boolean {
  const messageId = tdMessageId(message);
  return messageId !== undefined && messageId < cursorMessageId;
}

function nextTelegramSecond(date: Date): Date {
  return new Date(
    Math.floor(date.getTime() / TELEGRAM_SECOND_MS) * TELEGRAM_SECOND_MS + TELEGRAM_SECOND_MS
  );
}

function ceilToTelegramSecond(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / TELEGRAM_SECOND_MS) * TELEGRAM_SECOND_MS);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
