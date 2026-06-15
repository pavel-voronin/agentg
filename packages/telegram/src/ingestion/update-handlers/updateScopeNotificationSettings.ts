import type { UpdateByType } from '../../tdlib/shape.js';
import { upsertScopeNotificationSettings } from '../../store/notificationSettings.js';
import type { IngestionResources } from '../resources.js';

type ScopeNotificationSettingsUpdate = UpdateByType<'updateScopeNotificationSettings'>;

export async function handleUpdateScopeNotificationSettings(
  update: ScopeNotificationSettingsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await upsertScopeNotificationSettings(database, {
    notificationSettings: update.notification_settings,
    scope: update.scope
  });
}
