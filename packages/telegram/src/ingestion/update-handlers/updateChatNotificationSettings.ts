import { storeChatNotificationSettings } from '../../store/chat.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatNotificationSettingsUpdate = UpdateByType<'updateChatNotificationSettings'>;

export async function handleUpdateChatNotificationSettings(
  update: ChatNotificationSettingsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeChatNotificationSettings(database, update);
}
