import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { supergroupChanges } from '../group.js';
import type { IngestionResources } from '../../resources.js';

type SupergroupUpdate = UpdateByType<'updateSupergroup'>;

export async function handleUpdateSupergroup(
  update: SupergroupUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, supergroupChanges(update));
}
