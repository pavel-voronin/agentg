import { applyIngestionChanges } from '../../applyChanges.js';
import { activeNotificationSnapshotChanges } from '../activeNotification.js';
import { activeNotificationSnapshotFileSlots } from '../fileSlot.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ActiveNotificationsUpdate = UpdateByType<'updateActiveNotifications'>;

export async function handleUpdateActiveNotifications(
  { groups }: ActiveNotificationsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, activeNotificationSnapshotChanges(groups));
  await files.recordFileSlots(activeNotificationSnapshotFileSlots(groups), 'live_update');
}
