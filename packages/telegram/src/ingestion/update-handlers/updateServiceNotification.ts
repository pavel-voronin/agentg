import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ServiceNotificationUpdate = UpdateByType<'updateServiceNotification'>;

export async function handleUpdateServiceNotification(
  update: ServiceNotificationUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramServiceNotificationReceived(update);
  return Promise.resolve();
}
