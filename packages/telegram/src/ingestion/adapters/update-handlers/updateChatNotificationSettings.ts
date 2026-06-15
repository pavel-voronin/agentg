import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatNotificationSettingsChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatNotificationSettingsUpdate = UpdateByType<'updateChatNotificationSettings'>;

export async function handleUpdateChatNotificationSettings(
  update: ChatNotificationSettingsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatNotificationSettingsChanges(update));
}
