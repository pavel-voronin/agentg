import { applyIngestionChanges } from '../../applyChanges.js';
import { stickerSetFileSlots } from '../fileSlot.js';
import { stickerSetChanges } from '../sticker.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type StickerSetUpdate = UpdateByType<'updateStickerSet'>;

export async function handleUpdateStickerSet(
  update: StickerSetUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, stickerSetChanges(update));
  await files.recordFileSlots(stickerSetFileSlots(update.sticker_set), 'live_update');
}
