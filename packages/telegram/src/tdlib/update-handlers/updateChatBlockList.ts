import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatBlockListUpdate = TelegramWireUpdateByType<'updateChatBlockList'>;

export async function handleUpdateChatBlockList(
  update: TelegramWireChatBlockListUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    blockList: telegramWireJsonValue(update.block_list ?? null) ?? null,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
