import { upsertActiveNotification } from '../../store/activeNotification.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireNotificationUpdate = TelegramWireUpdateByType<'updateNotification'>;

export async function handleUpdateNotification({
  notification_group_id,
  notification
}: TelegramWireNotificationUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  await upsertActiveNotification(database, {
    groupId: notification_group_id,
    notification
  });
  await files.recordNotificationFiles(notification_group_id, notification, 'live_update');
  events.publishTelegramActiveNotificationsUpdated();
}
