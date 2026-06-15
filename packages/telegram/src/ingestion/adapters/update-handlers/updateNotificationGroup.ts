import { applyIngestionChanges } from '../../applyChanges.js';
import {
  activeNotificationGroupUpdateChanges,
  syntheticNotificationGroup
} from '../activeNotification.js';
import { notificationGroupFileSlots } from '../fileSlot.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type NotificationGroupUpdate = UpdateByType<'updateNotificationGroup'>;

export async function handleUpdateNotificationGroup(
  update: NotificationGroupUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, activeNotificationGroupUpdateChanges(update));

  await files.recordFileSlots(
    notificationGroupFileSlots([syntheticNotificationGroup(update)]),
    'live_update'
  );
}
