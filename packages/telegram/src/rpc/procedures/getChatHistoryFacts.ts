import { query } from '@agentg/rpc/domain';
import { z } from 'zod';

import type { TelegramRpcRuntime } from '../setup.js';
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import type { TelegramDatabase } from '../../database/client.js';
import { telegramChatPositions, telegramChats, telegramMessages } from '../../database/schema.js';
import type { TelegramProcedureContext } from '../../procedure-runtime/context.js';
import { readChatSelection, toTelegramChatStorageRow } from '../../read-model/chat.js';
import { readTelegramChatUsersByChat, telegramChatUserId } from '../../read-model/chatUser.js';
import { toNullableIsoString } from '../../read-model/dates.js';
import {
  isoDateTimeStringSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema
} from '../../read-model/api.js';

export const telegramChatHistoryFactsChatSchema = z.object({
  _model: z.literal('telegram.chat'),
  id: z.string(),
  isBot: z.boolean(),
  title: z.string(),
  type: z.string(),
  updatedAt: isoDateTimeStringSchema
});

export const telegramGetChatHistoryFactsInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

export const telegramGetChatHistoryFactsOutputSchema = z.object({
  chat: telegramChatHistoryFactsChatSchema.nullable(),
  earliestMessageDate: isoDateTimeStringSchema.nullable(),
  messageCount: nonNegativeIntegerSchema
});

export type TelegramChatHistoryFactsChat = z.infer<typeof telegramChatHistoryFactsChatSchema>;
export type TelegramGetChatHistoryFactsInput = z.infer<
  typeof telegramGetChatHistoryFactsInputSchema
>;
export type TelegramGetChatHistoryFactsOutput = z.infer<
  typeof telegramGetChatHistoryFactsOutputSchema
>;

export const getChatHistoryFacts = query((runtime: TelegramRpcRuntime, procedure) =>
  procedure
    .input(telegramGetChatHistoryFactsInputSchema)
    .output(telegramGetChatHistoryFactsOutputSchema)
    .query(({ input }) => runGetChatHistoryFacts(runtime, input))
);

async function runGetChatHistoryFacts(
  { database }: TelegramProcedureContext,
  input: TelegramGetChatHistoryFactsInput
): Promise<TelegramGetChatHistoryFactsOutput> {
  const [chat] = await database
    .select(readChatSelection())
    .from(telegramChats)
    .where(eq(telegramChats.id, input.chatId))
    .limit(1);

  if (chat === undefined) {
    return {
      chat: null,
      earliestMessageDate: null,
      messageCount: 0
    };
  }

  const row = toTelegramChatStorageRow(chat);
  if (!(await hasStoredChatPlacement(database, input.chatId))) {
    return {
      chat: null,
      earliestMessageDate: null,
      messageCount: 0
    };
  }

  const [earliestMessages, messageCounts] = await Promise.all([
    database
      .select({
        messageDate: telegramMessages.date
      })
      .from(telegramMessages)
      .where(and(eq(telegramMessages.chatId, input.chatId), isNotNull(telegramMessages.date)))
      .orderBy(asc(telegramMessages.date))
      .limit(1),
    database
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(telegramMessages)
      .where(eq(telegramMessages.chatId, input.chatId))
  ]);

  return {
    chat: await historyFactsChat(database, row),
    earliestMessageDate: toNullableIsoString(earliestMessages[0]?.messageDate ?? null),
    messageCount: messageCounts[0]?.count ?? 0
  };
}

async function hasStoredChatPlacement(
  database: TelegramDatabase,
  chatId: string
): Promise<boolean> {
  const [placement] = await database
    .select({
      chatId: telegramChatPositions.chatId
    })
    .from(telegramChatPositions)
    .where(eq(telegramChatPositions.chatId, chatId))
    .limit(1);

  return placement !== undefined;
}

async function historyFactsChat(
  database: TelegramDatabase,
  chat: ReturnType<typeof toTelegramChatStorageRow>
): Promise<TelegramGetChatHistoryFactsOutput['chat']> {
  const usersById = await readTelegramChatUsersByChat(database, [chat.chat]);
  const user = usersById.get(telegramChatUserId(chat.chat) ?? '');

  return {
    _model: 'telegram.chat',
    id: chat.telegramChatId,
    isBot: user?.isBot === true,
    title: chat.title,
    type: chat.type,
    updatedAt: new Date(0).toISOString()
  };
}
