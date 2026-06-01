import { removeChatListMembership } from '../../store/chatListMembership.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatRemovedFromListUpdate = UpdateByType<'updateChatRemovedFromList'>;

export async function handleUpdateChatRemovedFromList(
  update: ChatRemovedFromListUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await removeChatListMembership(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
