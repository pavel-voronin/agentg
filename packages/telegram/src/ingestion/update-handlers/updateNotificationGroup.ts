import { applyActiveNotificationGroupUpdate } from '../../store/activeNotification.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NotificationGroupUpdate = UpdateByType<'updateNotificationGroup'>;
type ActiveNotificationGroup = UpdateByType<'updateActiveNotifications'>['groups'][number];

export async function handleUpdateNotificationGroup(
  update: NotificationGroupUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  await applyActiveNotificationGroupUpdate(database, update);

  const syntheticGroup: ActiveNotificationGroup = {
    _: 'notificationGroup',
    chat_id: update.chat_id,
    id: update.notification_group_id,
    notifications: update.added_notifications,
    total_count: update.total_count,
    type: update.type
  };

  await files.recordNotificationGroupFiles([syntheticGroup], 'live_update');
  await events.publishTelegramActiveNotificationsUpdated();
}
