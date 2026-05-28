import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireId, type TelegramWireUpdateByType } from '../wire.js';

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
