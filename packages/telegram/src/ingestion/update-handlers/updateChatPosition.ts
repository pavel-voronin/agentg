import { storeChatPosition } from '../../store/chat.js';
import type { ChatPositionUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateChatPosition(
  update: ChatPositionUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await storeChatPosition(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
