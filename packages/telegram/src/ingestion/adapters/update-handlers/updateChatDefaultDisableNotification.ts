import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatDefaultDisableNotificationChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatDefaultDisableNotificationUpdate = UpdateByType<'updateChatDefaultDisableNotification'>;

export async function handleUpdateChatDefaultDisableNotification(
  update: ChatDefaultDisableNotificationUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatDefaultDisableNotificationChanges(update));
}
