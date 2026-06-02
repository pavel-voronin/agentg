import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../database/client.js';
import { telegramChatPositions, telegramChats, telegramMessages } from '../database/schema.js';
import { readChatSelection, toChatStorageRow } from '../views/chat.js';
import { chatUserId, readChatUsersByChat } from '../views/chatUser.js';
import { toNullableIsoString } from '../views/date.js';
import {
  isoDateTimeStringSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema
} from '../views/schemas.js';
import type { ProcedureResources } from './resources.js';

const chatSchema = z.object({
  _model: z.literal('telegram.chat'),
  id: z.string(),
  isBot: z.boolean(),
  title: z.string(),
  type: z.string(),
  updatedAt: isoDateTimeStringSchema
});

const inputSchema = z.object({
  chatId: nonEmptyStringSchema
});

const outputSchema = z.object({
  chat: chatSchema.nullable(),
  earliestMessageDate: isoDateTimeStringSchema.nullable(),
  messageCount: nonNegativeIntegerSchema
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export function getChatHistoryFactsProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<Output> => {
    const output = await runGetChatHistoryFacts(inputSchema.parse(input), resources);
    return outputSchema.parse(output);
  };
}

async function runGetChatHistoryFacts(
  input: Input,
  resources: ProcedureResources
): Promise<Output> {
  const [chat] = await resources.database
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

  const row = toChatStorageRow(chat);
  if (!(await hasStoredChatPlacement(resources.database, input.chatId))) {
    return {
      chat: null,
      earliestMessageDate: null,
      messageCount: 0
    };
  }

  const [earliestMessages, messageCounts] = await Promise.all([
    resources.database
      .select({
        messageDate: telegramMessages.date
      })
      .from(telegramMessages)
      .where(and(eq(telegramMessages.chatId, input.chatId), isNotNull(telegramMessages.date)))
      .orderBy(asc(telegramMessages.date))
      .limit(1),
    resources.database
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(telegramMessages)
      .where(eq(telegramMessages.chatId, input.chatId))
  ]);

  return {
    chat: await historyFactsChat(resources.database, row),
    earliestMessageDate: toNullableIsoString(earliestMessages[0]?.messageDate ?? null),
    messageCount: messageCounts[0]?.count ?? 0
  };
}

async function hasStoredChatPlacement(database: Database, chatId: string): Promise<boolean> {
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
  database: Database,
  chat: ReturnType<typeof toChatStorageRow>
): Promise<Output['chat']> {
  const usersById = await readChatUsersByChat(database, [chat.chat]);
  const user = usersById.get(chatUserId(chat.chat) ?? '');

  return {
    _model: 'telegram.chat',
    id: chat.telegramChatId,
    isBot: user?.isBot === true,
    title: chat.title,
    type: chat.type,
    updatedAt: new Date(0).toISOString()
  };
}
