import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type OwnedStarCountUpdate = UpdateByType<'updateOwnedStarCount'>;

export function handleUpdateOwnedStarCount(
  update: OwnedStarCountUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'owned_star_count', update.star_amount);
}
