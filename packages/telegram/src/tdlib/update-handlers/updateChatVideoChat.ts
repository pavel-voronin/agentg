import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatVideoChatUpdate = TelegramWireUpdateByType<'updateChatVideoChat'>;

export async function handleUpdateChatVideoChat(
  update: TelegramWireChatVideoChatUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    videoChat: telegramWireJsonValue(update.video_chat) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
