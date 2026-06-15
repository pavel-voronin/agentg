import { storeUserFullInfo } from '../../store/userFullInfo.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type UserFullInfoUpdate = UpdateByType<'updateUserFullInfo'>;

export async function handleUpdateUserFullInfo(
  update: UserFullInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  const userId = String(update.user_id);

  await storeUserFullInfo(database, userId, update.user_full_info);
  await files.recordUserFullInfoFiles(userId, update.user_full_info, 'live_update');
}
