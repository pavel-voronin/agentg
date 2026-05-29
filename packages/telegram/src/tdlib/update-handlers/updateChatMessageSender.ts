import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatMessageSenderUpdate = TelegramWireUpdateByType<'updateChatMessageSender'>;

export async function handleUpdateChatMessageSender(
  update: TelegramWireChatMessageSenderUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    messageSenderId: telegramWireJsonValue(update.message_sender_id ?? null) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
