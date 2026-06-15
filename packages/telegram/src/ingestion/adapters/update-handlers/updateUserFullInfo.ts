import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { userFullInfoFileSlots } from '../fileSlot.js';
import { userFullInfoChanges } from '../user.js';
import type { IngestionResources } from '../../resources.js';

type UserFullInfoUpdate = UpdateByType<'updateUserFullInfo'>;

export async function handleUpdateUserFullInfo(
  update: UserFullInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const userId = String(update.user_id);

  await applyIngestionChanges(resources, userFullInfoChanges(update));
  await files.recordFileSlots(userFullInfoFileSlots(userId, update.user_full_info), 'live_update');
}
