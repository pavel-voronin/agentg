import { storeUserStatus } from '../../store/userStatus.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type UserStatusUpdate = UpdateByType<'updateUserStatus'>;

export async function handleUpdateUserStatus(
  update: UserStatusUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeUserStatus(database, update.user_id, update.status);
}
