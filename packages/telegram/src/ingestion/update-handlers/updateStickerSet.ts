import { upsertStickerSet } from '../../store/stickerSet.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type StickerSetUpdate = UpdateByType<'updateStickerSet'>;

export async function handleUpdateStickerSet(
  update: StickerSetUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  await upsertStickerSet(database, update.sticker_set);
  await files.recordStickerSetFiles(update.sticker_set, 'live_update');
}
