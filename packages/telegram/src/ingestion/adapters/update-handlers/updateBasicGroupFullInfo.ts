import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { basicGroupFullInfoChanges } from '../group.js';
import type { IngestionResources } from '../../resources.js';

type BasicGroupFullInfoUpdate = UpdateByType<'updateBasicGroupFullInfo'>;

export async function handleUpdateBasicGroupFullInfo(
  update: BasicGroupFullInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, basicGroupFullInfoChanges(update));
}
