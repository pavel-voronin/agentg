import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type SavedAnimationsUpdate = UpdateByType<'updateSavedAnimations'>;

export function handleUpdateSavedAnimations(
  update: SavedAnimationsUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'saved_animations', update.animation_ids);
}
