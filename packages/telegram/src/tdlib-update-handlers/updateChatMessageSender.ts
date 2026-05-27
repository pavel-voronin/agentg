import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatMessageSenderUpdate = TelegramWireUpdateByType<'updateChatMessageSender'>;

export async function handleUpdateChatMessageSender(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatMessageSenderUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    messageSenderId: telegramWireJsonValue(update.message_sender_id ?? null) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
