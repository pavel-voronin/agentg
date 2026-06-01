import { storeChatListMembership } from '../../store/chatListMembership.js';
import type { ChatAddedToListUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateChatAddedToList(
  update: ChatAddedToListUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await storeChatListMembership(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
