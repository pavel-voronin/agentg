import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatUnreadPollVoteCountChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatUnreadPollVoteCountUpdate = UpdateByType<'updateChatUnreadPollVoteCount'>;

export async function handleUpdateChatUnreadPollVoteCount(
  update: ChatUnreadPollVoteCountUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatUnreadPollVoteCountChanges(update));
}
