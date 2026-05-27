import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireFavoriteStickersUpdate = TelegramWireUpdateByType<'updateFavoriteStickers'>;

export function handleUpdateFavoriteStickers(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireFavoriteStickersUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'favorite_stickers', update.sticker_ids);
}
