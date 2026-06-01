import { and, eq } from 'drizzle-orm';

import { telegramMessages } from '../../database/schema.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type VideoPublishedUpdate = UpdateByType<'updateVideoPublished'>;

export async function handleUpdateVideoPublished(
  update: VideoPublishedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
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
