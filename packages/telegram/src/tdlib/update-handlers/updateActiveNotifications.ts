import { replaceActiveNotificationSnapshot } from '../../store/activeNotification.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireActiveNotificationsUpdate = TelegramWireUpdateByType<'updateActiveNotifications'>;

export async function handleUpdateActiveNotifications({
  groups
}: TelegramWireActiveNotificationsUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  await replaceActiveNotificationSnapshot(database, groups);
  await files.recordNotificationGroupFiles(groups, 'live_update');
  events.publishTelegramActiveNotificationsUpdated();
}
