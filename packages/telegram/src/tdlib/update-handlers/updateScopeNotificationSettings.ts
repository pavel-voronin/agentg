import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { upsertScopeNotificationSettings } from '../../store/notificationSettings.js';

type TelegramWireScopeNotificationSettingsUpdate =
  TelegramWireUpdateByType<'updateScopeNotificationSettings'>;

export function handleUpdateScopeNotificationSettings(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireScopeNotificationSettingsUpdate
): Promise<void> {
  return upsertScopeNotificationSettings(context.database, {
    notificationSettings: update.notification_settings,
    scope: update.scope
  }).then((scopeKey) => {
    context.events.publishTelegramScopeNotificationSettingsUpdated(scopeKey);
  });
}
