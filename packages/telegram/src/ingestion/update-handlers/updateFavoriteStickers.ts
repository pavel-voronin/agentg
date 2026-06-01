import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type FavoriteStickersUpdate = UpdateByType<'updateFavoriteStickers'>;

export function handleUpdateFavoriteStickers(
  update: FavoriteStickersUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'favorite_stickers', update.sticker_ids);
}
