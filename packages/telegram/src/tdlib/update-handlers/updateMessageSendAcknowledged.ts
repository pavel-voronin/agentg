import { and, eq } from 'drizzle-orm';

import { telegramMessages } from '../../database/schema.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireMessageSendAcknowledgedUpdate =
  TelegramWireUpdateByType<'updateMessageSendAcknowledged'>;

export async function handleUpdateMessageSendAcknowledged(
  update: TelegramWireMessageSendAcknowledgedUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
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
