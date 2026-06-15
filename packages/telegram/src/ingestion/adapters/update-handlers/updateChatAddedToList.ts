import { applyIngestionChanges } from '../../applyChanges.js';
import { chatListMembershipAddedChanges } from '../chat.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ChatAddedToListUpdate = UpdateByType<'updateChatAddedToList'>;

export async function handleUpdateChatAddedToList(
  update: ChatAddedToListUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatListMembershipAddedChanges(update));
}
