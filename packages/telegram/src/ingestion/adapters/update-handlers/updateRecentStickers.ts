import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type RecentStickersUpdate = UpdateByType<'updateRecentStickers'>;

export function handleUpdateRecentStickers(
  update: RecentStickersUpdate,
  resources: IngestionResources
): Promise<void> {
  const key = update.is_attached ? 'recent_stickers_attached' : 'recent_stickers_sent';

  return saveKvEntry(resources, key, update.sticker_ids);
}
