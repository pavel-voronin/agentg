import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../wire.js';

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
