import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatIsTranslatableUpdate = TelegramWireUpdateByType<'updateChatIsTranslatable'>;

export async function handleUpdateChatIsTranslatable(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatIsTranslatableUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    isTranslatable: update.is_translatable
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
