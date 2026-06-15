import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { savedUserChanges } from '../user.js';
import type { IngestionResources } from '../../resources.js';

type UserUpdate = UpdateByType<'updateUser'>;

export async function handleUpdateUser(
  { user }: UserUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, savedUserChanges(user));
}
