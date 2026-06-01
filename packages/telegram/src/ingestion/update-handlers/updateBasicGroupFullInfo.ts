import { storeBasicGroupFullInfo } from '../../store/basicGroupFullInfo.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type BasicGroupFullInfoUpdate = UpdateByType<'updateBasicGroupFullInfo'>;

export async function handleUpdateBasicGroupFullInfo(
  update: BasicGroupFullInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const basicGroupId = String(update.basic_group_id);

  await database.transaction(async (transaction) => {
    await storeBasicGroupFullInfo(transaction, basicGroupId, update.basic_group_full_info);
  });
}
