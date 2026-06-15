import { storeChatListMembership } from '../../store/chatListMembership.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatAddedToListUpdate = UpdateByType<'updateChatAddedToList'>;

export async function handleUpdateChatAddedToList(
  update: ChatAddedToListUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeChatListMembership(database, update);
}
