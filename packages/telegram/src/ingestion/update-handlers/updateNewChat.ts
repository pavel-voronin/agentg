import { recordChatFiles, storeChat } from '../../store/chat.js';
import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { NewChatUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateNewChat(
  { chat }: NewChatUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  const lastMessage = chat.last_message ?? null;
  await database.transaction(async (transaction) => {
    if (lastMessage !== null) {
      await storeMessage(transaction, lastMessage);
    }

    await storeChat(transaction, chat);
  });

  await recordChatFiles(files, chat, 'live_update');
  if (lastMessage !== null) {
    await recordMessageFiles(files, lastMessage, 'live_update');
  }

  await events.publishTelegramChatDiscovered(String(chat.id));
  await events.publishTelegramChatDirectoryUpdated(String(chat.id));
}
