import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireReactionNotificationSettingsUpdate =
  TelegramWireUpdateByType<'updateReactionNotificationSettings'>;

export function handleUpdateReactionNotificationSettings(
  update: TelegramWireReactionNotificationSettingsUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'reaction_notification_settings', update.notification_settings);
}
