import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type SpeedLimitNotificationUpdate = UpdateByType<'updateSpeedLimitNotification'>;

export function handleUpdateSpeedLimitNotification(
  update: SpeedLimitNotificationUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
