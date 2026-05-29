import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireFavoriteStickersUpdate = TelegramWireUpdateByType<'updateFavoriteStickers'>;

export function handleUpdateFavoriteStickers(
  update: TelegramWireFavoriteStickersUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'favorite_stickers', update.sticker_ids);
}
