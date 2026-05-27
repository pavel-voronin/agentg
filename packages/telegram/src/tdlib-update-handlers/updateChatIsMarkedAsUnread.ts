import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatIsMarkedAsUnreadUpdate =
  TelegramWireUpdateByType<'updateChatIsMarkedAsUnread'>;

export async function handleUpdateChatIsMarkedAsUnread(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatIsMarkedAsUnreadUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    isMarkedAsUnread: update.is_marked_as_unread
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
