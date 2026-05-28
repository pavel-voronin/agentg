import { query } from '@agentg/rpc/domain';
import { z } from 'zod';

import type { TelegramRpcRuntime } from '../setup.js';
import { desc, eq, sql } from 'drizzle-orm';
import { telegramMessages } from '../../database/schema.js';
import { andSql } from '../../read-model/sql.js';
import { readMessageSelection, toReadMessages } from '../../read-model/message.js';
import { parseLimit } from '../input.js';
import {
  nonEmptyStringSchema,
  positiveIntegerSchema,
  telegramReadMessageSchema
} from '../../read-model/api.js';

export const telegramListRecentMessagesInputSchema = z
  .object({
    beforeMessageId: nonEmptyStringSchema.regex(/^[0-9]+$/).optional(),
    chatId: nonEmptyStringSchema.optional(),
    limit: positiveIntegerSchema.optional()
  })
  .default({});

export const telegramListRecentMessagesOutputSchema = z.object({
  messages: z.array(telegramReadMessageSchema)
});

export type TelegramListRecentMessagesInput = z.infer<typeof telegramListRecentMessagesInputSchema>;
export type TelegramListRecentMessagesOutput = z.infer<
  typeof telegramListRecentMessagesOutputSchema
>;

export const listRecentMessages = query((runtime: TelegramRpcRuntime, procedure) =>
  procedure
    .input(telegramListRecentMessagesInputSchema)
    .output(telegramListRecentMessagesOutputSchema)
    .query(({ input }) => runListRecentMessages(runtime, input))
);

async function runListRecentMessages(
  { database }: TelegramRpcRuntime,
  input: TelegramListRecentMessagesInput
): Promise<TelegramListRecentMessagesOutput> {
  const limit = parseLimit(input.limit, 50, 200);
  const where = andSql(
    input.chatId === undefined ? undefined : eq(telegramMessages.chatId, input.chatId),
    input.beforeMessageId === undefined
      ? undefined
      : sql`${telegramMessages.id}::bigint < ${input.beforeMessageId}::bigint`
  );
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
