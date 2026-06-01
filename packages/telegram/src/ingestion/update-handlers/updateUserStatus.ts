import { storeUserStatus } from '../../store/userStatus.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type UserStatusUpdate = UpdateByType<'updateUserStatus'>;

export async function handleUpdateUserStatus(
  update: UserStatusUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await storeUserStatus(database, update.user_id, update.status);
  await events.publishTelegramUserStatusUpdated(update);
}
