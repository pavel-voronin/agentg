import { storeSticker } from '../../store/sticker.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type AnimatedEmojiMessageClickedUpdate = UpdateByType<'updateAnimatedEmojiMessageClicked'>;

export async function handleUpdateAnimatedEmojiMessageClicked(
  update: AnimatedEmojiMessageClickedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await database.transaction(async (transaction) => {
    await storeSticker(transaction, update.sticker);
  });

  await events.publishTelegramAnimatedEmojiMessageClicked(update);
}
