import { replaceActiveNotificationSnapshot } from '../../store/activeNotification.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireActiveNotificationsUpdate = TelegramWireUpdateByType<'updateActiveNotifications'>;

export async function handleUpdateActiveNotifications(
  { database, events, files }: TelegramUpdateHandlerContext,
  { groups }: TelegramWireActiveNotificationsUpdate
): Promise<void> {
  await replaceActiveNotificationSnapshot(database, groups);
  await files.recordNotificationGroupFiles(groups, 'live_update');
  events.publishTelegramActiveNotificationsUpdated();
}
