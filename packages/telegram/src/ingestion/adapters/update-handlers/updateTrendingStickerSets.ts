import { saveKvEntry } from '../../kv.js';
import { trendingStickerSetFileSlots } from '../fileSlot.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type TrendingStickerSetsUpdate = UpdateByType<'updateTrendingStickerSets'>;

export async function handleUpdateTrendingStickerSets(
  update: TrendingStickerSetsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const key = `trending_sticker_sets_by_type:${update.sticker_type._}`;

  await saveKvEntry(resources, key, update.sticker_sets);
  await files.recordFileSlots(trendingStickerSetFileSlots(update.sticker_sets), 'live_update');
}
