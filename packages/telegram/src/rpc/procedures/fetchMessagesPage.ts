import { mutation } from '@agentg/rpc/surface';
import { and, eq, inArray } from 'drizzle-orm';

import { createTelegramHistoryCoverageChangedEvent } from '../../integrationEvents.js';
import { telegramChats, telegramMessages } from '../../schema.js';
import { recordMessageFiles, storeMessage } from '../../telegram-store/message.js';
import {
  normalizeCoverageWriteInput,
  withTelegramHistoryCoverageLocks,
  writeTelegramHistoryCoverageInTransaction,
  type TelegramHistoryCoverageInterval,
  type TelegramHistoryCoverageWriteSegment
} from '../../telegramHistoryCoverage.js';
import { countTelegramMessagesInIntervals } from '../../telegramMessageCounts.js';
import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../../telegramHistoryTime.js';
import { telegramTdlibPriorities } from '../../telegramTdlibPriority.js';
import type { TelegramWireMessage, TelegramWireMessages } from '../../telegramWire.js';
import {
  telegramFetchMessagesPageInputSchema,
  telegramFetchMessagesPageOutputSchema,
  type TelegramReadMessage
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import {
  invokeTdlib,
  oldestMessageDate,
  oldestMessageIdOlderThan,
  parseLimit,
  parseTelegramChatId,
  readMessageSelection,
  tdMessageId,
  toTelegramDate,
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
      const initialAnchor =
        cursorMessageId === undefined ? await readInitialPageAnchor(runtime, input.chatId) : null;
      const pageEndAt =
        cursorMessageId === undefined
          ? (initialAnchor?.pageEndAt ?? ceilToTelegramSecond(new Date()))
          : await readMessagePageEndAt(runtime, input.chatId, input.beforeMessageId);
      const anchorMessageId = cursorMessageId ?? initialAnchor?.messageId ?? 0;

      const history = (await invokeTdlib(
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
          priority: telegramTdlibPriorities.high
        }
      )) as TelegramWireMessages;
      const fetchedMessages = history.messages.filter(isDefined);
      const pageMessages =
        cursorMessageId === undefined
          ? fetchedMessages
          : fetchedMessages.filter((message) => isOlderThanCursor(message, cursorMessageId));
      const nextCursorMessageId = nextCursorForFetchedPage(fetchedMessages, anchorMessageId);
      const reachedStart =
        anchorMessageId === 0 ? fetchedMessages.length < limit : nextCursorMessageId === undefined;
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
      const messageIds =
        cursorMessageId === undefined && initialAnchor?.messageIdText !== undefined
          ? [initialAnchor.messageIdText, ...persisted.messageIds]
          : persisted.messageIds;
      const messages = await readPersistedMessages(runtime, input.chatId, messageIds);

      return {
        messages,
        reachedStart
      };
    })
);

async function readInitialPageAnchor(
  runtime: TelegramRpcRuntime,
  chatId: string
): Promise<{ messageId: number; messageIdText: string; pageEndAt: Date | undefined } | undefined> {
  const [chat] = await runtime.database
    .select({
      lastMessageId: telegramChats.lastMessageId
    })
    .from(telegramChats)
    .where(eq(telegramChats.id, chatId))
    .limit(1);
  const messageId = parseOptionalMessageId(chat?.lastMessageId ?? undefined);

  if (
    chat?.lastMessageId === null ||
    chat?.lastMessageId === undefined ||
    messageId === undefined
  ) {
    return undefined;
  }

  return {
    messageId,
    messageIdText: chat.lastMessageId,
    pageEndAt: await readMessagePageEndAt(runtime, chatId, chat.lastMessageId)
  };
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
      messageDate: telegramMessages.date
    })
    .from(telegramMessages)
    .where(and(eq(telegramMessages.chatId, chatId), eq(telegramMessages.id, messageId)))
    .limit(1);

  const messageDate =
    message?.messageDate === null || message?.messageDate === undefined
      ? null
      : toTelegramDate(message.messageDate);
  return messageDate === null ? undefined : nextTelegramSecond(messageDate);
}

async function persistMessagesAndCoverage(
  runtime: TelegramRpcRuntime,
  input: {
    coverage: TelegramHistoryCoverageInterval | undefined;
    messages: TelegramWireMessage[];
  }
): Promise<{ coverageIntervals: TelegramHistoryCoverageEventInterval[]; messageIds: string[] }> {
  const coverageIntervals =
    input.coverage === undefined ? [] : normalizeCoverageWriteInput([input.coverage], new Date());
  const messageIds: string[] = [];

  await withTelegramHistoryCoverageLocks(
    input.coverage === undefined ? [] : [input.coverage.chatId],
    async () =>
      runtime.database.transaction(async (transaction) => {
        for (const message of input.messages) {
          const stored = await storeMessage(transaction, message);
          if (stored) {
            messageIds.push(String(message.id));
          }
        }

        if (coverageIntervals.length > 0) {
          await writeTelegramHistoryCoverageInTransaction(transaction, coverageIntervals);
        }
      })
  );

  for (const message of input.messages) {
    await recordMessageFiles(runtime.files, message, 'operator_page');
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
      and(eq(telegramMessages.chatId, chatId), inArray(telegramMessages.id, orderedMessageIds))
    );
  const rowsById = new Map(rows.map((row) => [row.telegramMessageId, row]));
  const orderedRows = orderedMessageIds
    .map((messageId) => rowsById.get(messageId))
    .filter(isDefined);

  return toReadMessages(runtime.database, orderedRows);
}

function observedIntervalStartAt(
  messages: TelegramWireMessage[],
  reachedStart: boolean
): Date | null | undefined {
  if (reachedStart) {
    return null;
  }

  const oldest = oldestMessageDate(messages);
  return oldest === undefined ? undefined : nextTelegramSecond(oldest);
}

function nextCursorForFetchedPage(
  messages: TelegramWireMessage[],
  anchorMessageId: number
): number | undefined {
  if (anchorMessageId !== 0) {
    return oldestMessageIdOlderThan(messages, anchorMessageId);
  }

  const ids = messages.map(tdMessageId).filter((id): id is number => id !== undefined);
  return ids.length === 0 ? undefined : Math.min(...ids);
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

function isOlderThanCursor(message: TelegramWireMessage, cursorMessageId: number): boolean {
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

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
