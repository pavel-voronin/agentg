import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatMessageAutoDeleteTimeUpdate =
  TelegramWireUpdateByType<'updateChatMessageAutoDeleteTime'>;

export async function handleUpdateChatMessageAutoDeleteTime(
  update: TelegramWireChatMessageAutoDeleteTimeUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    messageAutoDeleteTime: update.message_auto_delete_time
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
