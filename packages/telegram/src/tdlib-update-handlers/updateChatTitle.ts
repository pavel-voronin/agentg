import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatTitleUpdate = TelegramWireUpdateByType<'updateChatTitle'>;

export async function handleUpdateChatTitle(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatTitleUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    title: update.title
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
