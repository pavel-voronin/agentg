import type { UpdateByType } from '../types.js';
import { upsertScopeNotificationSettings } from '../../store/notificationSettings.js';
import type { IngestionResources } from '../resources.js';

type ScopeNotificationSettingsUpdate = UpdateByType<'updateScopeNotificationSettings'>;

export async function handleUpdateScopeNotificationSettings(
  update: ScopeNotificationSettingsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const scopeKey = await upsertScopeNotificationSettings(database, {
    notificationSettings: update.notification_settings,
    scope: update.scope
  });
  await events.publishTelegramScopeNotificationSettingsUpdated(scopeKey);
}
