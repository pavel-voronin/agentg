import { applyIngestionChanges } from '../../applyChanges.js';
import { chatMemberChanges } from '../chatMember.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ChatMemberUpdate = UpdateByType<'updateChatMember'>;

export async function handleUpdateChatMember(
  update: ChatMemberUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatMemberChanges(update));
}
