import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type SavedNotificationSoundsUpdate = UpdateByType<'updateSavedNotificationSounds'>;

export function handleUpdateSavedNotificationSounds(
  update: SavedNotificationSoundsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'saved_notification_sound_ids', update.notification_sound_ids);
}
