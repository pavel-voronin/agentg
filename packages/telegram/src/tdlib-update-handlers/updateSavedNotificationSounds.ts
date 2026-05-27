import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireSavedNotificationSoundsUpdate =
  TelegramWireUpdateByType<'updateSavedNotificationSounds'>;

export function handleUpdateSavedNotificationSounds(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireSavedNotificationSoundsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'saved_notification_sound_ids', update.notification_sound_ids);
}
