import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type OwnedStarCountUpdate = UpdateByType<'updateOwnedStarCount'>;

export function handleUpdateOwnedStarCount(
  update: OwnedStarCountUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'owned_star_count', update.star_amount);
}
