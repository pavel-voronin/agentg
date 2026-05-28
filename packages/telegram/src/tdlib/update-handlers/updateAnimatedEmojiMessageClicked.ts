import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { storeSticker } from '../../store/sticker.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireAnimatedEmojiMessageClickedUpdate =
  TelegramWireUpdateByType<'updateAnimatedEmojiMessageClicked'>;

export async function handleUpdateAnimatedEmojiMessageClicked(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireAnimatedEmojiMessageClickedUpdate
): Promise<void> {
  await database.transaction(async (transaction) => {
    await storeSticker(transaction, update.sticker);
  });

  events.publishTelegramAnimatedEmojiMessageClicked(update);
}
