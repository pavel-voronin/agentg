import { applyActiveNotificationGroupUpdate } from '../../store/activeNotification.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNotificationGroupUpdate = TelegramWireUpdateByType<'updateNotificationGroup'>;
type TelegramWireActiveNotificationGroup =
  TelegramWireUpdateByType<'updateActiveNotifications'>['groups'][number];

export async function handleUpdateNotificationGroup(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireNotificationGroupUpdate
): Promise<void> {
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
