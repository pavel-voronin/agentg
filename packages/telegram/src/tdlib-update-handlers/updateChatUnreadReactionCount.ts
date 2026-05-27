import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatUnreadReactionCountUpdate =
  TelegramWireUpdateByType<'updateChatUnreadReactionCount'>;

export async function handleUpdateChatUnreadReactionCount(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatUnreadReactionCountUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadReactionCount: update.unread_reaction_count
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
