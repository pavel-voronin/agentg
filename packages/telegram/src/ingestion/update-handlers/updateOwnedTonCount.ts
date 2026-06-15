import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type OwnedTonCountUpdate = UpdateByType<'updateOwnedTonCount'>;

export function handleUpdateOwnedTonCount(
  update: OwnedTonCountUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'owned_ton_count', update.ton_amount);
}
