import { and, desc, eq, ilike, sql } from 'drizzle-orm';

import type {
  TelegramSearchMessagesInput,
  TelegramSearchMessagesOutput
} from '../rpc/contracts.js';
import { telegramMessages } from '../schema.js';
import type { TelegramProcedureHandlerContext } from '../telegram-procedure-runtime/context.js';
import {
  messageTextExpression,
  readMessageSelection,
  toReadMessages
} from '../telegram-read-model/message.js';
import { parseLimit } from './helpers.js';

export async function handleSearchMessages(
  { database }: TelegramProcedureHandlerContext,
  input: TelegramSearchMessagesInput
): Promise<TelegramSearchMessagesOutput> {
  const text = input.query.trim();
  const limit = parseLimit(input.limit, 20, 100);
  const textFilter = ilike(sql<string>`coalesce(${messageTextExpression()}, '')`, `%${text}%`);
  const where =
    input.chatId === undefined
      ? textFilter
      : and(eq(telegramMessages.chatId, input.chatId), textFilter);
  const messages = await database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(where)
    .orderBy(desc(telegramMessages.date), sql`${telegramMessages.id}::bigint desc`)
    .limit(limit);

  return {
    messages: await toReadMessages(database, messages)
  };
}
