import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type OwnedTonCountUpdate = UpdateByType<'updateOwnedTonCount'>;

export function handleUpdateOwnedTonCount(
  update: OwnedTonCountUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'owned_ton_count', update.ton_amount);
}
