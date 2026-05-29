import { mutation } from '@agentg/framework';
import { z } from 'zod';

import { and, eq, inArray } from 'drizzle-orm';
import { useDatabase } from '../../../database/subsystem.js';
import { useEvents } from '../../../events/subsystem.js';
import { useFiles } from '../../../files/subsystem.js';
import { createTelegramHistoryCoverageChangedEvent } from '../../../events/contracts.js';
import { telegramChats, telegramMessages } from '../../../database/schema.js';
import { storeMessage } from '../../../store/message.js';
import {
  normalizeCoverageWriteInput,
  withTelegramHistoryCoverageLocks,
  writeTelegramHistoryCoverageInTransaction,
  type TelegramHistoryCoverageInterval,
  type TelegramHistoryCoverageWriteSegment
} from '../../../history/coverage.js';
import { countTelegramMessagesInIntervals } from '../../../history/messageCounts.js';
import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../../../history/time.js';
import { telegramTdlibPriorities } from '../../../tdlib/priority.js';
import { useTdlib } from '../../../tdlib/subsystem.js';
import {
  telegramWireDate,
  telegramWireIdNumber,
  type TelegramWireMessage
} from '../../../tdlib/wire.js';
import { toTelegramDate } from '../../../read-model/dates.js';
import { readMessageSelection, toReadMessages } from '../../../read-model/message.js';
import { parseLimit } from '@agentg/framework';
import {
  nonEmptyStringSchema,
  positiveIntegerSchema,
  telegramReadMessageSchema
} from '../../../read-model/api.js';

export const messagesPageInputSchema = z.object({
  beforeMessageId: nonEmptyStringSchema.regex(/^[0-9]+$/).optional(),
  chatId: nonEmptyStringSchema,
  limit: positiveIntegerSchema.optional()
});

export const messagesPageOutputSchema = z.object({
  messages: z.array(telegramReadMessageSchema),
  reachedStart: z.boolean()
});

export type MessagesPageInput = z.infer<typeof messagesPageInputSchema>;
export type MessagesPageOutput = z.infer<typeof messagesPageOutputSchema>;

export const messagesPage = mutation((procedure) =>
  procedure
    .input(messagesPageInputSchema)
    .output(messagesPageOutputSchema)
    .mutation(({ input }) => runMessagesPage(input))
);

const TELEGRAM_MESSAGE_PAGE_LIMIT = 100;
const TELEGRAM_MESSAGE_PAGE_MAX_LIMIT = 100;
const TELEGRAM_SECOND_MS = 1000;

type TelegramHistoryCoverageEventInterval = TelegramHistoryCoverageWriteSegment & {
  messageCount: number;
};

async function runMessagesPage(input: MessagesPageInput): Promise<MessagesPageOutput> {
  const limit = parseLimit(
    input.limit,
    TELEGRAM_MESSAGE_PAGE_LIMIT,
    TELEGRAM_MESSAGE_PAGE_MAX_LIMIT
  );
  const chatId = parseTelegramChatId(input.chatId);
  const cursorMessageId = parseOptionalMessageId(input.beforeMessageId);
  const initialAnchor =
    cursorMessageId === undefined ? await readInitialPageAnchor(input.chatId) : null;
  const pageEndAt =
    cursorMessageId === undefined
      ? (initialAnchor?.pageEndAt ?? ceilToTelegramSecond(new Date()))
      : await readMessagePageEndAt(input.chatId, input.beforeMessageId);
  const anchorMessageId = cursorMessageId ?? initialAnchor?.messageId ?? 0;

  const tdlib = useTdlib();
  const history = await tdlib.getChatHistory(
    {
      chatId,
      fromMessageId: anchorMessageId,
      limit,
      offset: 0,
      onlyLocal: false
    },
    {
      priority: telegramTdlibPriorities.high
    }
  );
  const fetchedMessages = history.messages.filter(isDefined);
  const pageMessages =
    cursorMessageId === undefined
      ? fetchedMessages
      : fetchedMessages.filter((message) => isOlderThanCursor(message, cursorMessageId));
  const nextCursorMessageId = nextCursorForFetchedPage(fetchedMessages, anchorMessageId);
  const reachedStart =
    anchorMessageId === 0 ? fetchedMessages.length < limit : nextCursorMessageId === undefined;
  const observedStartAt = observedIntervalStartAt(pageMessages, reachedStart);
  const persisted = await persistMessagesAndCoverage({
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
  const messages = await readPersistedMessages(input.chatId, messageIds);
  scheduleOperatorPageFileRecording(pageMessages);

  return {
    messages,
    reachedStart
  };
}

async function readInitialPageAnchor(
  chatId: string
): Promise<{ messageId: number; messageIdText: string; pageEndAt: Date | undefined } | undefined> {
  const database = useDatabase();
  const [chat] = await database
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
    pageEndAt: await readMessagePageEndAt(chatId, chat.lastMessageId)
  };
}

async function readMessagePageEndAt(
  chatId: string,
  messageId: string | undefined
): Promise<Date | undefined> {
  const database = useDatabase();
  if (messageId === undefined) {
    return undefined;
  }

  const [message] = await database
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

async function persistMessagesAndCoverage(input: {
  coverage: TelegramHistoryCoverageInterval | undefined;
  messages: TelegramWireMessage[];
}): Promise<{ coverageIntervals: TelegramHistoryCoverageEventInterval[]; messageIds: string[] }> {
  const database = useDatabase();
  const events = useEvents();
  const coverageIntervals =
    input.coverage === undefined ? [] : normalizeCoverageWriteInput([input.coverage], new Date());
  const messageIds: string[] = [];

  await withTelegramHistoryCoverageLocks(
    input.coverage === undefined ? [] : [input.coverage.chatId],
    async () =>
      database.transaction(async (transaction) => {
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

  const coverageEventIntervals = await addCoverageMessageCounts(coverageIntervals);
  if (coverageIntervals.length > 0) {
    events.publish(
      createTelegramHistoryCoverageChangedEvent({
        intervals: coverageEventIntervals
      })
    );
  }

  return { coverageIntervals: coverageEventIntervals, messageIds };
}

function scheduleOperatorPageFileRecording(messages: TelegramWireMessage[]): void {
  if (messages.length === 0) {
    return;
  }

  const files = useFiles();
  const recordMessageFiles = files.recordMessageFiles.bind(files);
  setImmediate(() => {
    void recordOperatorPageFiles(messages, recordMessageFiles).catch((error: unknown) => {
      console.error(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          event: 'telegram.operator_page_file_recording_failed',
          messageCount: messages.length
        })
      );
    });
  });
}

async function recordOperatorPageFiles(
  messages: TelegramWireMessage[],
  recordMessageFiles: ReturnType<typeof useFiles>['recordMessageFiles']
): Promise<void> {
  for (const message of messages) {
    await recordMessageFiles(message, 'operator_page');
  }
}

async function addCoverageMessageCounts(
  intervals: TelegramHistoryCoverageWriteSegment[]
): Promise<TelegramHistoryCoverageEventInterval[]> {
  const database = useDatabase();
  const counts =
    intervals.length === 0 ? [] : await countTelegramMessagesInIntervals(database, intervals);
  return intervals.map((interval, index) => ({
    ...interval,
    messageCount: counts[index] ?? 0
  }));
}

async function readPersistedMessages(chatId: string, messageIds: string[]) {
  const database = useDatabase();
  const orderedMessageIds = [...new Set(messageIds)];
  if (orderedMessageIds.length === 0) {
    return [];
  }

  const rows = await database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(
      and(eq(telegramMessages.chatId, chatId), inArray(telegramMessages.id, orderedMessageIds))
    );
  const rowsById = new Map(rows.map((row) => [row.telegramMessageId, row]));
  const orderedRows = orderedMessageIds
    .map((messageId) => rowsById.get(messageId))
    .filter(isDefined);

  return toReadMessages(database, orderedRows);
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
  if (anchorMessageId > 0) {
    return oldestMessageIdOlderThan(messages, anchorMessageId);
  }

  const ids = messages.map(tdMessageId).filter((id): id is number => id !== undefined);
  return ids.length === 0 ? undefined : Math.min(...ids);
}

function isOlderThanCursor(message: TelegramWireMessage, cursorMessageId: number): boolean {
  const messageId = tdMessageId(message);
  return messageId !== undefined && messageId < cursorMessageId;
}

function parseTelegramChatId(value: string): number {
  const text = value.trim();
  const parsed = Number(text);
  if (text.length === 0 || !Number.isSafeInteger(parsed)) {
    throw new Error(`Telegram chat id must be numeric: ${text}`);
  }
  return parsed;
}

function parseOptionalMessageId(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function tdMessageId(message: TelegramWireMessage | undefined): number | undefined {
  return telegramWireIdNumber(message?.id);
}

function tdMessageDate(message: TelegramWireMessage | undefined): Date | undefined {
  return telegramWireDate(message?.date);
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

function nextTelegramSecond(date: Date): Date {
  return new Date(
    Math.floor(date.getTime() / TELEGRAM_SECOND_MS) * TELEGRAM_SECOND_MS + TELEGRAM_SECOND_MS
  );
}

function ceilToTelegramSecond(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / TELEGRAM_SECOND_MS) * TELEGRAM_SECOND_MS);
}

function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}
