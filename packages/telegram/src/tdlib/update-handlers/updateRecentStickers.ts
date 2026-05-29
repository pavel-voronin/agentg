import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireRecentStickersUpdate = TelegramWireUpdateByType<'updateRecentStickers'>;

export function handleUpdateRecentStickers(
  update: TelegramWireRecentStickersUpdate
): Promise<void> {
  const database = useDatabase();
  const key = update.is_attached ? 'recent_stickers_attached' : 'recent_stickers_sent';

  return upsertTelegramKv(database, key, update.sticker_ids);
}
