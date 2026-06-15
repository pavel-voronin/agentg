import { applyIngestionChanges } from '../../applyChanges.js';
import { stickerChanges } from '../sticker.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type AnimatedEmojiMessageClickedUpdate = UpdateByType<'updateAnimatedEmojiMessageClicked'>;

export async function handleUpdateAnimatedEmojiMessageClicked(
  update: AnimatedEmojiMessageClickedUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, stickerChanges(update));
}
