import { and, eq } from 'drizzle-orm';

import { telegramMessages } from '../schema.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireMessageSendAcknowledgedUpdate =
  TelegramWireUpdateByType<'updateMessageSendAcknowledged'>;

export async function handleUpdateMessageSendAcknowledged(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageSendAcknowledgedUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);
  const messageKey = and(eq(telegramMessages.chatId, chatId), eq(telegramMessages.id, messageId));

  const [storedMessage] = await database
    .select({ id: telegramMessages.id })
    .from(telegramMessages)
    .where(messageKey)
    .limit(1);

  if (storedMessage === undefined) {
    return;
  }

  const [updatedMessage] = await database
    .update(telegramMessages)
    .set({ sendAcknowledged: true })
    .where(messageKey)
    .returning({ id: telegramMessages.id });

  if (updatedMessage === undefined) {
    return;
  }

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}
