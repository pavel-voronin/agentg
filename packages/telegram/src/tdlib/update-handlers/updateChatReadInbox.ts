import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireId, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatReadInboxUpdate = TelegramWireUpdateByType<'updateChatReadInbox'>;

export async function handleUpdateChatReadInbox(
  update: TelegramWireChatReadInboxUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    lastReadInboxMessageId: telegramWireId(update.last_read_inbox_message_id),
    unreadCount: update.unread_count
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
