import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

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
