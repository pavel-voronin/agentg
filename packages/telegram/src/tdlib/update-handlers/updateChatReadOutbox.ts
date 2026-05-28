import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireId, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatReadOutboxUpdate = TelegramWireUpdateByType<'updateChatReadOutbox'>;

export async function handleUpdateChatReadOutbox(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatReadOutboxUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    lastReadOutboxMessageId: telegramWireId(update.last_read_outbox_message_id)
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
