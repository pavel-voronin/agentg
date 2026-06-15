import { removeChatListMembership } from '../../store/chatListMembership.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatRemovedFromListUpdate = UpdateByType<'updateChatRemovedFromList'>;

export async function handleUpdateChatRemovedFromList(
  update: ChatRemovedFromListUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await removeChatListMembership(database, update);
}
