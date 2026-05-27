import { replaceActiveNotificationSnapshot } from '../telegram-store/activeNotification.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireActiveNotificationsUpdate = TelegramWireUpdateByType<'updateActiveNotifications'>;

export async function handleUpdateActiveNotifications(
  { database, events, files }: TelegramUpdateHandlerContext,
  { groups }: TelegramWireActiveNotificationsUpdate
): Promise<void> {
  await replaceActiveNotificationSnapshot(database, groups);
  await files.recordNotificationGroupFiles(groups, 'live_update');
  events.publishTelegramActiveNotificationsUpdated();
}
