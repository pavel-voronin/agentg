import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type SavedNotificationSoundsUpdate = UpdateByType<'updateSavedNotificationSounds'>;

export function handleUpdateSavedNotificationSounds(
  update: SavedNotificationSoundsUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'saved_notification_sound_ids', update.notification_sound_ids);
}
