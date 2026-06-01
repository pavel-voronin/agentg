import { replaceActiveNotificationSnapshot } from '../../store/activeNotification.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ActiveNotificationsUpdate = UpdateByType<'updateActiveNotifications'>;

export async function handleUpdateActiveNotifications(
  { groups }: ActiveNotificationsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  await replaceActiveNotificationSnapshot(database, groups);
  await files.recordActiveNotificationSnapshotFiles(groups, 'live_update');
  await events.publishTelegramActiveNotificationsUpdated();
}
