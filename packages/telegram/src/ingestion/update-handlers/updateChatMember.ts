import { storeChatMember } from '../../store/chatMember.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatMemberUpdate = UpdateByType<'updateChatMember'>;

export async function handleUpdateChatMember(
  update: ChatMemberUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await storeChatMember(database, update);
  await events.publishTelegramChatMemberUpdated(update);
}
