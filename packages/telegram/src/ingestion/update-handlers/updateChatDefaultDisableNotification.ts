import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatDefaultDisableNotificationUpdate = UpdateByType<'updateChatDefaultDisableNotification'>;

export async function handleUpdateChatDefaultDisableNotification(
  update: ChatDefaultDisableNotificationUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    defaultDisableNotification: update.default_disable_notification,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
