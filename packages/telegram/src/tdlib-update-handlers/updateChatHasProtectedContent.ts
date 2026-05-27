import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatHasProtectedContentUpdate =
  TelegramWireUpdateByType<'updateChatHasProtectedContent'>;

export async function handleUpdateChatHasProtectedContent(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatHasProtectedContentUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    hasProtectedContent: update.has_protected_content,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
