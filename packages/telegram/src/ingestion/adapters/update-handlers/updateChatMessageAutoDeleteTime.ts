import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatMessageAutoDeleteTimeChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatMessageAutoDeleteTimeUpdate = UpdateByType<'updateChatMessageAutoDeleteTime'>;

export async function handleUpdateChatMessageAutoDeleteTime(
  update: ChatMessageAutoDeleteTimeUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatMessageAutoDeleteTimeChanges(update));
}
