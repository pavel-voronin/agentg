import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type HavePendingNotificationsUpdate = UpdateByType<'updateHavePendingNotifications'>;

export function handleUpdateHavePendingNotifications(
  update: HavePendingNotificationsUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
