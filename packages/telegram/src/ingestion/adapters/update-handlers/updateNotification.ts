import { applyIngestionChanges } from '../../applyChanges.js';
import { activeNotificationChanges } from '../activeNotification.js';
import { notificationFileSlots } from '../fileSlot.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type NotificationUpdate = UpdateByType<'updateNotification'>;

export async function handleUpdateNotification(
  { notification_group_id, notification }: NotificationUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(
    resources,
    activeNotificationChanges({
      groupId: notification_group_id,
      notification
    })
  );
  await files.recordFileSlots(
    notificationFileSlots(notification_group_id, notification),
    'live_update'
  );
}
