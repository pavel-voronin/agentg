import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type TrendingStickerSetsUpdate = UpdateByType<'updateTrendingStickerSets'>;

export async function handleUpdateTrendingStickerSets(
  update: TrendingStickerSetsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  const key = `trending_sticker_sets_by_type:${update.sticker_type._}`;

  await upsertTelegramKv(database, key, update.sticker_sets);
  await files.recordTrendingStickerSetFiles(update.sticker_sets, 'live_update');
}
