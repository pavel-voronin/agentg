import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatUnreadMentionCountUpdate =
  TelegramWireUpdateByType<'updateChatUnreadMentionCount'>;

export async function handleUpdateChatUnreadMentionCount(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatUnreadMentionCountUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadMentionCount: update.unread_mention_count
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
