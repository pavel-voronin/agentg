import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatEmojiStatusUpdate = TelegramWireUpdateByType<'updateChatEmojiStatus'>;

export async function handleUpdateChatEmojiStatus(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatEmojiStatusUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    emojiStatus: telegramWireJsonValue(update.emoji_status ?? null) ?? null,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
