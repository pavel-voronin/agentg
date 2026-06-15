import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ReactionNotificationSettingsUpdate = UpdateByType<'updateReactionNotificationSettings'>;

export function handleUpdateReactionNotificationSettings(
  update: ReactionNotificationSettingsUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'reaction_notification_settings', update.notification_settings);
}
