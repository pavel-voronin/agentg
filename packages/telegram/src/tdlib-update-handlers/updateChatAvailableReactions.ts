import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatAvailableReactionsUpdate =
  TelegramWireUpdateByType<'updateChatAvailableReactions'>;

export async function handleUpdateChatAvailableReactions(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatAvailableReactionsUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    availableReactions: telegramWireJsonObject(update.available_reactions),
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
