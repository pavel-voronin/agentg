import { storeSupergroupFullInfo } from '../../store/supergroupFullInfo.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type SupergroupFullInfoUpdate = UpdateByType<'updateSupergroupFullInfo'>;

export async function handleUpdateSupergroupFullInfo(
  update: SupergroupFullInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const supergroupId = String(update.supergroup_id);

  await database.transaction(async (transaction) => {
    await storeSupergroupFullInfo(transaction, supergroupId, update.supergroup_full_info);
  });
}
