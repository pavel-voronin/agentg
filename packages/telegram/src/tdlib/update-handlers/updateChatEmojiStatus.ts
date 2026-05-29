import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatEmojiStatusUpdate = TelegramWireUpdateByType<'updateChatEmojiStatus'>;

export async function handleUpdateChatEmojiStatus(
  update: TelegramWireChatEmojiStatusUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    emojiStatus: telegramWireJsonValue(update.emoji_status ?? null) ?? null,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
