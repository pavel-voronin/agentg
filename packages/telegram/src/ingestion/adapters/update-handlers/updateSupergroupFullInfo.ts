import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { supergroupFullInfoChanges } from '../group.js';
import type { IngestionResources } from '../../resources.js';

type SupergroupFullInfoUpdate = UpdateByType<'updateSupergroupFullInfo'>;

export async function handleUpdateSupergroupFullInfo(
  update: SupergroupFullInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, supergroupFullInfoChanges(update));
}
