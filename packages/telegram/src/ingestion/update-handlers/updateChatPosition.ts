import { storeChatPosition } from '../../store/chat.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatPositionUpdate = UpdateByType<'updateChatPosition'>;

export async function handleUpdateChatPosition(
  update: ChatPositionUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeChatPosition(database, update);
}
