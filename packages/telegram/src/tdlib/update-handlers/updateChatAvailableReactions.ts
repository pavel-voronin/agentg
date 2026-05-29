import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatAvailableReactionsUpdate =
  TelegramWireUpdateByType<'updateChatAvailableReactions'>;

export async function handleUpdateChatAvailableReactions(
  update: TelegramWireChatAvailableReactionsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    availableReactions: telegramWireJsonObject(update.available_reactions),
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
