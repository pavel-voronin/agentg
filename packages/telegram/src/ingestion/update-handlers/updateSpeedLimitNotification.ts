import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type SpeedLimitNotificationUpdate = UpdateByType<'updateSpeedLimitNotification'>;

export async function handleUpdateSpeedLimitNotification(
  update: SpeedLimitNotificationUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramSpeedLimitNotificationReceived(update);
  return Promise.resolve();
}
