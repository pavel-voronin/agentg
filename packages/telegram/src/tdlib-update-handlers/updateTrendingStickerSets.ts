import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireTrendingStickerSetsUpdate = TelegramWireUpdateByType<'updateTrendingStickerSets'>;

export async function handleUpdateTrendingStickerSets(
  { database, files }: TelegramUpdateHandlerContext,
  update: TelegramWireTrendingStickerSetsUpdate
): Promise<void> {
  const key = `trending_sticker_sets_by_type:${update.sticker_type._}`;

  await upsertTelegramKv(database, key, update.sticker_sets);
  await files.recordTrendingStickerSetFiles(update.sticker_sets, 'live_update');
}
