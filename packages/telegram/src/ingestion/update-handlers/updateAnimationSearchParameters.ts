import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type AnimationSearchParametersUpdate = UpdateByType<'updateAnimationSearchParameters'>;

export function handleUpdateAnimationSearchParameters(
  update: AnimationSearchParametersUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'animation_search_parameters', {
    provider: update.provider,
    emojis: update.emojis
  });
}
