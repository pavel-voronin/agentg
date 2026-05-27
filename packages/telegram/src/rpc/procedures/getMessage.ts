import { query } from '@agentg/rpc/surface';
import { telegramGetMessageInputSchema, telegramGetMessageOutputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { and, eq } from 'drizzle-orm';
import type { TelegramGetMessageInput, TelegramGetMessageOutput } from '../contracts.js';
import { telegramMessages } from '../../schema.js';
import type { TelegramProcedureContext } from '../../telegram-procedure-runtime/context.js';
import { readMessageSelection, toReadMessages } from '../../telegram-read-model/message.js';

export const getMessage = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetMessageInputSchema)
    .output(telegramGetMessageOutputSchema)
    .query(({ input }) => runGetMessage(runtime, input))
);

async function runGetMessage(
  { database }: TelegramProcedureContext,
  input: TelegramGetMessageInput
): Promise<TelegramGetMessageOutput> {
  const [message] = await database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(and(eq(telegramMessages.chatId, input.chatId), eq(telegramMessages.id, input.messageId)))
    .limit(1);
  const [readMessage] = await toReadMessages(database, message === undefined ? [] : [message]);

  return {
    message: readMessage ?? null
  };
}
