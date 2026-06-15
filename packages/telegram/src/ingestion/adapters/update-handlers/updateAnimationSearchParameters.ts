import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type AnimationSearchParametersUpdate = UpdateByType<'updateAnimationSearchParameters'>;

export function handleUpdateAnimationSearchParameters(
  update: AnimationSearchParametersUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'animation_search_parameters', {
    provider: update.provider,
    emojis: update.emojis
  });
}
