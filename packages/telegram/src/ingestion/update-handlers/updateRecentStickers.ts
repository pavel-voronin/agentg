import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type RecentStickersUpdate = UpdateByType<'updateRecentStickers'>;

export function handleUpdateRecentStickers(
  update: RecentStickersUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const key = update.is_attached ? 'recent_stickers_attached' : 'recent_stickers_sent';

  return upsertTelegramKv(database, key, update.sticker_ids);
}
