import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatMessageAutoDeleteTimeUpdate =
  TelegramWireUpdateByType<'updateChatMessageAutoDeleteTime'>;

export async function handleUpdateChatMessageAutoDeleteTime(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatMessageAutoDeleteTimeUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    messageAutoDeleteTime: update.message_auto_delete_time
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
