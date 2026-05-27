import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatHasScheduledMessagesUpdate =
  TelegramWireUpdateByType<'updateChatHasScheduledMessages'>;

export async function handleUpdateChatHasScheduledMessages(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatHasScheduledMessagesUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    hasScheduledMessages: update.has_scheduled_messages,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
