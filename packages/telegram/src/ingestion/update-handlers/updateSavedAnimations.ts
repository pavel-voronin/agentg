import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type SavedAnimationsUpdate = UpdateByType<'updateSavedAnimations'>;

export function handleUpdateSavedAnimations(
  update: SavedAnimationsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'saved_animations', update.animation_ids);
}
