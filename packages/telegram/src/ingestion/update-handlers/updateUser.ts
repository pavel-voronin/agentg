import { storeUser } from '../../store/user.js';
import type { UserUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateUser(
  { user }: UserUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await storeUser(database, user);
  await events.publishTelegramUserUpdated(user);
}
