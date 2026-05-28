import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireFavoriteStickersUpdate = TelegramWireUpdateByType<'updateFavoriteStickers'>;

export function handleUpdateFavoriteStickers(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireFavoriteStickersUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'favorite_stickers', update.sticker_ids);
}
