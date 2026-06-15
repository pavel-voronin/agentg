import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { basicGroupChanges } from '../group.js';
import type { IngestionResources } from '../../resources.js';

type BasicGroupUpdate = UpdateByType<'updateBasicGroup'>;

export async function handleUpdateBasicGroup(
  update: BasicGroupUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, basicGroupChanges(update));
}
