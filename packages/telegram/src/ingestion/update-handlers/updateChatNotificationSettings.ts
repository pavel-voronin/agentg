import { storeChatNotificationSettings } from '../../store/chat.js';
import type { ChatNotificationSettingsUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateChatNotificationSettings(
  update: ChatNotificationSettingsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await storeChatNotificationSettings(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
