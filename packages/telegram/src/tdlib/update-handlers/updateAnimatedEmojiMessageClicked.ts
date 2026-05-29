import { storeSticker } from '../../store/sticker.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireAnimatedEmojiMessageClickedUpdate =
  TelegramWireUpdateByType<'updateAnimatedEmojiMessageClicked'>;

export async function handleUpdateAnimatedEmojiMessageClicked(
  update: TelegramWireAnimatedEmojiMessageClickedUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await database.transaction(async (transaction) => {
    await storeSticker(transaction, update.sticker);
  });

  events.publishTelegramAnimatedEmojiMessageClicked(update);
}
