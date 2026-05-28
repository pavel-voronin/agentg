import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramMessageFragment } from '../../store/message.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireMessageIsPinnedUpdate = TelegramWireUpdateByType<'updateMessageIsPinned'>;

export async function handleUpdateMessageIsPinned(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageIsPinnedUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await upsertTelegramMessageFragment(database, {
    chatId,
    id: messageId,
    isPinned: update.is_pinned
  });

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}
