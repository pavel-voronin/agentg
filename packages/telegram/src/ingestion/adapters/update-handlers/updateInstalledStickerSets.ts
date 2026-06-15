import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type InstalledStickerSetsUpdate = UpdateByType<'updateInstalledStickerSets'>;

export function handleUpdateInstalledStickerSets(
  update: InstalledStickerSetsUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(
    resources,
    `installed_sticker_sets_by_type:${update.sticker_type._}`,
    update.sticker_set_ids
  );
}
