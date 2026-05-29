import { applyActiveNotificationGroupUpdate } from '../../store/activeNotification.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireNotificationGroupUpdate = TelegramWireUpdateByType<'updateNotificationGroup'>;
type TelegramWireActiveNotificationGroup =
  TelegramWireUpdateByType<'updateActiveNotifications'>['groups'][number];

export async function handleUpdateNotificationGroup(
  update: TelegramWireNotificationGroupUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  await applyActiveNotificationGroupUpdate(database, update);

  const syntheticGroup: TelegramWireActiveNotificationGroup = {
    _: 'notificationGroup',
    chat_id: update.chat_id,
    id: update.notification_group_id,
    notifications: update.added_notifications,
    total_count: update.total_count,
    type: update.type
  };

  await files.recordNotificationGroupFiles([syntheticGroup], 'live_update');
  events.publishTelegramActiveNotificationsUpdated();
}
