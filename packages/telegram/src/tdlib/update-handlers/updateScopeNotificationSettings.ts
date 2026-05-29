import type { TelegramWireUpdateByType } from '../wire.js';
import { upsertScopeNotificationSettings } from '../../store/notificationSettings.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireScopeNotificationSettingsUpdate =
  TelegramWireUpdateByType<'updateScopeNotificationSettings'>;

export function handleUpdateScopeNotificationSettings(
  update: TelegramWireScopeNotificationSettingsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  return upsertScopeNotificationSettings(database, {
    notificationSettings: update.notification_settings,
    scope: update.scope
  }).then((scopeKey) => {
    events.publishTelegramScopeNotificationSettingsUpdated(scopeKey);
  });
}
