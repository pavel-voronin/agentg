import { upsertActiveNotification } from '../../store/activeNotification.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNotificationUpdate = TelegramWireUpdateByType<'updateNotification'>;

export async function handleUpdateNotification(
  { database, events, files }: TelegramUpdateHandlerContext,
  { notification_group_id, notification }: TelegramWireNotificationUpdate
): Promise<void> {
  await upsertActiveNotification(database, {
    groupId: notification_group_id,
    notification
  });
  await files.recordNotificationFiles(notification_group_id, notification, 'live_update');
  events.publishTelegramActiveNotificationsUpdated();
}
