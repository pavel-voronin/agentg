import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatVideoChatUpdate = TelegramWireUpdateByType<'updateChatVideoChat'>;

export async function handleUpdateChatVideoChat(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatVideoChatUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    videoChat: telegramWireJsonValue(update.video_chat) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
