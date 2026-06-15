import { replaceChatFolders } from '../../store/chatFolders.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatFoldersUpdate = UpdateByType<'updateChatFolders'>;

export async function handleUpdateChatFolders(
  update: ChatFoldersUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await replaceChatFolders(database, update);
}
