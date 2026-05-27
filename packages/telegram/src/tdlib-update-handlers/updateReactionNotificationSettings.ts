import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireReactionNotificationSettingsUpdate =
  TelegramWireUpdateByType<'updateReactionNotificationSettings'>;

export function handleUpdateReactionNotificationSettings(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireReactionNotificationSettingsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'reaction_notification_settings', update.notification_settings);
}
