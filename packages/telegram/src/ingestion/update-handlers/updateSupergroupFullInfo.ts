import { storeSupergroupFullInfo } from '../../store/supergroupFullInfo.js';
import type { SupergroupFullInfoUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateSupergroupFullInfo(
  update: SupergroupFullInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const supergroupId = String(update.supergroup_id);

  await database.transaction(async (transaction) => {
    await storeSupergroupFullInfo(transaction, supergroupId, update.supergroup_full_info);
  });

  await events.publishTelegramSupergroupUpdated(supergroupId);
}
