import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireId, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatReadOutboxUpdate = TelegramWireUpdateByType<'updateChatReadOutbox'>;

export async function handleUpdateChatReadOutbox(
  update: TelegramWireChatReadOutboxUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    lastReadOutboxMessageId: telegramWireId(update.last_read_outbox_message_id)
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
