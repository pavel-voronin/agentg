import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { userStatusChanges } from '../user.js';
import type { IngestionResources } from '../../resources.js';

type UserStatusUpdate = UpdateByType<'updateUserStatus'>;

export async function handleUpdateUserStatus(
  update: UserStatusUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, userStatusChanges(update));
}
