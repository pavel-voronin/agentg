import { and, eq } from 'drizzle-orm';

import type { TelegramGetMessageInput, TelegramGetMessageOutput } from '../rpc/contracts.js';
import { telegramMessages } from '../schema.js';
import type { TelegramProcedureHandlerContext } from '../telegram-procedure-runtime/context.js';
import { readMessageSelection, toReadMessages } from '../telegram-read-model/message.js';

export async function handleGetMessage(
  { database }: TelegramProcedureHandlerContext,
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
