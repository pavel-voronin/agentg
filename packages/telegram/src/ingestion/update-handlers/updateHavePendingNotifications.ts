import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type HavePendingNotificationsUpdate = UpdateByType<'updateHavePendingNotifications'>;

export async function handleUpdateHavePendingNotifications(
  update: HavePendingNotificationsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramPendingNotificationsUpdated(update);
}
