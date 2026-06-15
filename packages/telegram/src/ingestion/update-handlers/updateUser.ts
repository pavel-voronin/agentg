import { storeUser } from '../../store/user.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type UserUpdate = UpdateByType<'updateUser'>;

export async function handleUpdateUser(
  { user }: UserUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeUser(database, user);
}
