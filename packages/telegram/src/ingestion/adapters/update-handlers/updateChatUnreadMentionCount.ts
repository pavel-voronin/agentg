import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatUnreadMentionCountChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatUnreadMentionCountUpdate = UpdateByType<'updateChatUnreadMentionCount'>;

export async function handleUpdateChatUnreadMentionCount(
  update: ChatUnreadMentionCountUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatUnreadMentionCountChanges(update));
}
