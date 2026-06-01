import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ReactionNotificationSettingsUpdate = UpdateByType<'updateReactionNotificationSettings'>;

export function handleUpdateReactionNotificationSettings(
  update: ReactionNotificationSettingsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'reaction_notification_settings', update.notification_settings);
}
