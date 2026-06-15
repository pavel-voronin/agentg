import { applyIngestionChanges } from '../../applyChanges.js';
import { chatJoinRequestChanges } from '../chatMember.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type NewChatJoinRequestUpdate = UpdateByType<'updateNewChatJoinRequest'>;

export async function handleUpdateNewChatJoinRequest(
  update: NewChatJoinRequestUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatJoinRequestChanges(update));
}
