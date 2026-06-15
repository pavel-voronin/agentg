import { storeChatMember } from '../../store/chatMember.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatMemberUpdate = UpdateByType<'updateChatMember'>;

export async function handleUpdateChatMember(
  update: ChatMemberUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeChatMember(database, update);
}
