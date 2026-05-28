import { query } from '@agentg/rpc/surface';
import {
  telegramSearchMessagesInputSchema,
  telegramSearchMessagesOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import type { TelegramSearchMessagesInput, TelegramSearchMessagesOutput } from '../contracts.js';
import { telegramMessages } from '../../schema.js';
import type { TelegramProcedureContext } from '../../procedure-runtime/context.js';
import {
  messageTextExpression,
  readMessageSelection,
  toReadMessages
} from '../../read-model/message.js';
import { parseLimit } from '../../procedureInputs.js';

export const searchMessages = query((runtime: TelegramRpcRuntime) =>
  rpc
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
