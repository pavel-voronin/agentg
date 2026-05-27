import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import { telegramWireId, type TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatReadInboxUpdate = TelegramWireUpdateByType<'updateChatReadInbox'>;

export async function handleUpdateChatReadInbox(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatReadInboxUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    lastReadInboxMessageId: telegramWireId(update.last_read_inbox_message_id),
    unreadCount: update.unread_count
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
