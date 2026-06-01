import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type InstalledStickerSetsUpdate = UpdateByType<'updateInstalledStickerSets'>;

export function handleUpdateInstalledStickerSets(
  update: InstalledStickerSetsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(
    database,
    `installed_sticker_sets_by_type:${update.sticker_type._}`,
    update.sticker_set_ids
  );
}
