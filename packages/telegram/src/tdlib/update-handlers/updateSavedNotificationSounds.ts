import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireSavedNotificationSoundsUpdate =
  TelegramWireUpdateByType<'updateSavedNotificationSounds'>;

export function handleUpdateSavedNotificationSounds(
  update: TelegramWireSavedNotificationSoundsUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'saved_notification_sound_ids', update.notification_sound_ids);
}
