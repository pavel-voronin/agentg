import { mutation } from '@agentg/rpc/surface';
import { and, eq, inArray } from 'drizzle-orm';

import { createTelegramMessagesObservedEvent } from '../../integration-events.js';
import { asTdObject, normalizeHistoricalMessage, type TdObject } from '../../normalize.js';
import { telegramMessages } from '../../schema.js';
import { persistTelegramUpdate } from '../../store.js';
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
        publishMessagesObserved(runtime, {
          chatId: input.chatId,
          endAt: pageEndAt,
          fetchedMessages: 0,
          reachedStart: true,
          startAt: null,
          storedMessages: 0
        });
        return {
          messages: [],
          reachedStart: true
        };
      }

      const history = asTdObject(
        await invokeTdlib(runtime.eventBus, runtime.client, {
          _: 'getChatHistory',
          chat_id: chatId,
          from_message_id: anchorMessageId,
          limit,
          offset: 0,
          only_local: false
        })
      );
      const fetchedMessages = Array.isArray(history?.messages)
        ? history.messages.map(asTdObject).filter(isTdObject)
        : [];
      const pageMessages =
        cursorMessageId === undefined
          ? fetchedMessages
          : fetchedMessages.filter((message) => isOlderThanCursor(message, cursorMessageId));
      const storedMessageIds = await persistMessages(runtime, pageMessages);
      const messages = await readPersistedMessages(runtime, input.chatId, storedMessageIds);
      const nextCursorMessageId = oldestMessageIdOlderThan(fetchedMessages, anchorMessageId);
      const reachedStart = nextCursorMessageId === undefined;
      const observedStartAt = observedIntervalStartAt(pageMessages, reachedStart);

      publishMessagesObserved(runtime, {
        chatId: input.chatId,
        endAt: pageEndAt,
        fetchedMessages: pageMessages.length,
        reachedStart,
        startAt: observedStartAt,
        storedMessages: storedMessageIds.length
      });

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
    pageEndAt
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

async function persistMessages(
  runtime: TelegramRpcRuntime,
  messages: TdObject[]
): Promise<string[]> {
  const messageIds: string[] = [];
  for (const message of messages) {
    const normalized = normalizeHistoricalMessage(message);
    if (normalized?.message === undefined) {
      continue;
    }

    await persistTelegramUpdate(runtime.database, normalized);
    messageIds.push(normalized.message.messageId);
  }
  return messageIds;
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

function publishMessagesObserved(
  runtime: TelegramRpcRuntime,
  observation: {
    chatId: string;
    endAt: Date | undefined;
    fetchedMessages: number;
    reachedStart: boolean;
    startAt: Date | null | undefined;
    storedMessages: number;
  }
): void {
  if (observation.endAt === undefined || observation.startAt === undefined) {
    return;
  }
  if (observation.startAt !== null && observation.startAt >= observation.endAt) {
    return;
  }

  runtime.eventBus.publish(
    createTelegramMessagesObservedEvent({
      chatId: observation.chatId,
      endAt: observation.endAt,
      fetchedMessages: observation.fetchedMessages,
      reachedStart: observation.reachedStart,
      startAt: observation.startAt,
      storedMessages: observation.storedMessages
    })
  );
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
