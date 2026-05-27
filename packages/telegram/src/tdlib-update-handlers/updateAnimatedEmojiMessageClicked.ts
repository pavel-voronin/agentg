import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { storeSticker } from '../telegram-store/sticker.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

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
