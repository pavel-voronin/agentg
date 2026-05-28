import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireRecentStickersUpdate = TelegramWireUpdateByType<'updateRecentStickers'>;

export function handleUpdateRecentStickers(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireRecentStickersUpdate
): Promise<void> {
  const key = update.is_attached ? 'recent_stickers_attached' : 'recent_stickers_sent';

  return upsertTelegramKv(database, key, update.sticker_ids);
}
