import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatVideoChatChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatVideoChatUpdate = UpdateByType<'updateChatVideoChat'>;

export async function handleUpdateChatVideoChat(
  update: ChatVideoChatUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatVideoChatChanges(update));
}
