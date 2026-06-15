import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatPendingJoinRequestsChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatPendingJoinRequestsUpdate = UpdateByType<'updateChatPendingJoinRequests'>;

export async function handleUpdateChatPendingJoinRequests(
  update: ChatPendingJoinRequestsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatPendingJoinRequestsChanges(update));
}
