import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireReactionNotificationSettingsUpdate =
  TelegramWireUpdateByType<'updateReactionNotificationSettings'>;

export function handleUpdateReactionNotificationSettings(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireReactionNotificationSettingsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'reaction_notification_settings', update.notification_settings);
}
