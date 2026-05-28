import { query } from '@agentg/rpc/domain';
import { z } from 'zod';

import type { TelegramRpcRuntime } from '../setup.js';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { telegramMessages } from '../../database/schema.js';
import type { TelegramProcedureContext } from '../../procedure-runtime/context.js';
import {
  messageTextExpression,
  readMessageSelection,
  toReadMessages
} from '../../read-model/message.js';
import { parseLimit } from '../../procedure-runtime/inputs.js';
import {
  nonEmptyStringSchema,
  positiveIntegerSchema,
  telegramReadMessageSchema
} from '../../read-model/api.js';

export const telegramSearchMessagesInputSchema = z.object({
  chatId: nonEmptyStringSchema.optional(),
  limit: positiveIntegerSchema.optional(),
  query: nonEmptyStringSchema
});

export const telegramSearchMessagesOutputSchema = z.object({
  messages: z.array(telegramReadMessageSchema)
});

export type TelegramSearchMessagesInput = z.infer<typeof telegramSearchMessagesInputSchema>;
export type TelegramSearchMessagesOutput = z.infer<typeof telegramSearchMessagesOutputSchema>;

export const searchMessages = query((runtime: TelegramRpcRuntime, procedure) =>
  procedure
    .input(telegramSearchMessagesInputSchema)
    .output(telegramSearchMessagesOutputSchema)
    .query(({ input }) => runSearchMessages(runtime, input))
);

async function runSearchMessages(
  { database }: TelegramProcedureContext,
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
