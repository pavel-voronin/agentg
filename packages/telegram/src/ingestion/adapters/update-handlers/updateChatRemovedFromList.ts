import { applyIngestionChanges } from '../../applyChanges.js';
import { chatListMembershipRemovedChanges } from '../chat.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ChatRemovedFromListUpdate = UpdateByType<'updateChatRemovedFromList'>;

export async function handleUpdateChatRemovedFromList(
  update: ChatRemovedFromListUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatListMembershipRemovedChanges(update));
}
