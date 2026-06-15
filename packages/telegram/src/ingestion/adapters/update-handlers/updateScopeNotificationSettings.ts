import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { notificationSettingsChanges } from '../settings.js';
import type { IngestionResources } from '../../resources.js';

type ScopeNotificationSettingsUpdate = UpdateByType<'updateScopeNotificationSettings'>;

export async function handleUpdateScopeNotificationSettings(
  update: ScopeNotificationSettingsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, notificationSettingsChanges(update));
}
