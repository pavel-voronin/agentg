import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type FavoriteStickersUpdate = UpdateByType<'updateFavoriteStickers'>;

export function handleUpdateFavoriteStickers(
  update: FavoriteStickersUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'favorite_stickers', update.sticker_ids);
}
