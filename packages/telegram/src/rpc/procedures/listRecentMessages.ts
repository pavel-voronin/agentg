import { query } from '@agentg/rpc/surface';
import {
  telegramListRecentMessagesInputSchema,
  telegramListRecentMessagesOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { desc, eq, sql } from 'drizzle-orm';
import type {
  TelegramListRecentMessagesInput,
  TelegramListRecentMessagesOutput
} from '../contracts.js';
import { telegramMessages } from '../../schema.js';
import type { TelegramProcedureContext } from '../../telegram-procedure-runtime/context.js';
import { andSql } from '../../telegram-read-model/sql.js';
import { readMessageSelection, toReadMessages } from '../../telegram-read-model/message.js';
import { parseLimit } from '../../telegramProcedureInputs.js';

export const listRecentMessages = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramListRecentMessagesInputSchema)
    .output(telegramListRecentMessagesOutputSchema)
    .query(({ input }) => runListRecentMessages(runtime, input))
);

async function runListRecentMessages(
  { database }: TelegramProcedureContext,
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
