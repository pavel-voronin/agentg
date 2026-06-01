import { upsertActiveNotification } from '../../store/activeNotification.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NotificationUpdate = UpdateByType<'updateNotification'>;

export async function handleUpdateNotification(
  { notification_group_id, notification }: NotificationUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  await upsertActiveNotification(database, {
    groupId: notification_group_id,
    notification
  });
  await files.recordNotificationFiles(notification_group_id, notification, 'live_update');
  await events.publishTelegramActiveNotificationsUpdated();
}
