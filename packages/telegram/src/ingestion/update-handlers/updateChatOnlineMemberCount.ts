import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatOnlineMemberCountUpdate = UpdateByType<'updateChatOnlineMemberCount'>;

export async function handleUpdateChatOnlineMemberCount(
  update: ChatOnlineMemberCountUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramChatOnlineMemberCountUpdated(update);
}
