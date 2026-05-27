import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatViewAsTopicsUpdate = TelegramWireUpdateByType<'updateChatViewAsTopics'>;

export async function handleUpdateChatViewAsTopics(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatViewAsTopicsUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    viewAsTopics: update.view_as_topics
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
