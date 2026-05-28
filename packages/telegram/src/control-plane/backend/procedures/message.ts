import { query } from '@agentg/rpc/surface';
import { messageLookupInputSchema, messageLookupOutputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../../../rpc/runtime.js';
import { rpc } from '../../../rpc/trpc.js';
import { and, eq } from 'drizzle-orm';
import type { MessageLookupInput, MessageLookupOutput } from '../contracts.js';
import { telegramMessages } from '../../../schema.js';
import type { TelegramProcedureContext } from '../../../procedure-runtime/context.js';
import { readMessageSelection, toReadMessages } from '../../../read-model/message.js';

export const message = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(messageLookupInputSchema)
    .output(messageLookupOutputSchema)
    .query(({ input }) => runMessage(runtime, input))
);

async function runMessage(
  { database }: TelegramProcedureContext,
  input: MessageLookupInput
): Promise<MessageLookupOutput> {
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
