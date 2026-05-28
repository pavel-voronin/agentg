import { and, eq } from 'drizzle-orm';

import { telegramMessages } from '../../database/schema.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireVideoPublishedUpdate = TelegramWireUpdateByType<'updateVideoPublished'>;

export async function handleUpdateVideoPublished(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireVideoPublishedUpdate
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
    .set({ schedulingState: null })
    .where(messageKey)
    .returning({ id: telegramMessages.id });

  if (updatedMessage === undefined) {
    return;
  }

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}
