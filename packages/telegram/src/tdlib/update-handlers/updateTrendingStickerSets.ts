import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireTrendingStickerSetsUpdate = TelegramWireUpdateByType<'updateTrendingStickerSets'>;

export async function handleUpdateTrendingStickerSets(
  update: TelegramWireTrendingStickerSetsUpdate
): Promise<void> {
  const database = useDatabase();
  const files = useFiles();
  const key = `trending_sticker_sets_by_type:${update.sticker_type._}`;

  await upsertTelegramKv(database, key, update.sticker_sets);
  await files.recordTrendingStickerSetFiles(update.sticker_sets, 'live_update');
}
