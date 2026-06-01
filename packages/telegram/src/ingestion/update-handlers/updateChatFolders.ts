import { replaceChatFolders } from '../../store/chatFolders.js';
import type { ChatFoldersUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateChatFolders(
  update: ChatFoldersUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await replaceChatFolders(database, update);
  await events.publishTelegramChatFoldersUpdated(update);
}
