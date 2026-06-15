import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatUnreadReactionCountChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatUnreadReactionCountUpdate = UpdateByType<'updateChatUnreadReactionCount'>;

export async function handleUpdateChatUnreadReactionCount(
  update: ChatUnreadReactionCountUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatUnreadReactionCountChanges(update));
}
