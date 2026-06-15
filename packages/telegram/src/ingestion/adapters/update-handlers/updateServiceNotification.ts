import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ServiceNotificationUpdate = UpdateByType<'updateServiceNotification'>;

export function handleUpdateServiceNotification(
  update: ServiceNotificationUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
