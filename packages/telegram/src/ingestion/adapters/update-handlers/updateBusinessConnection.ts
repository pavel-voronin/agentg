import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { businessConnectionChanges } from '../businessConnection.js';
import type { IngestionResources } from '../../resources.js';

type BusinessConnectionUpdate = UpdateByType<'updateBusinessConnection'>;

export async function handleUpdateBusinessConnection(
  update: BusinessConnectionUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, businessConnectionChanges(update));
}
