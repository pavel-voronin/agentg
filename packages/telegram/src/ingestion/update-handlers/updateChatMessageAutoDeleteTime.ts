import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatMessageAutoDeleteTimeUpdate = UpdateByType<'updateChatMessageAutoDeleteTime'>;

export async function handleUpdateChatMessageAutoDeleteTime(
  update: ChatMessageAutoDeleteTimeUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    messageAutoDeleteTime: update.message_auto_delete_time
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
