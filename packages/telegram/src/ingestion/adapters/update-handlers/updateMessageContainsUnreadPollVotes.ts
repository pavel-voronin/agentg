import { applyIngestionChanges } from '../../applyChanges.js';
import { messageContainsUnreadPollVotesChanges } from '../chat.js';
import { updatedMessageStateChanges } from '../message.js';
import type { IngestionResources } from '../../resources.js';
import type { UpdateByType } from '../updateTypes.js';

type MessageContainsUnreadPollVotesUpdate = UpdateByType<'updateMessageContainsUnreadPollVotes'>;

export async function handleUpdateMessageContainsUnreadPollVotes(
  update: MessageContainsUnreadPollVotesUpdate,
  resources: IngestionResources
): Promise<void> {
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await applyIngestionChanges(resources, [
    ...updatedMessageStateChanges({
      chatId,
      containsUnreadPollVotes: update.contains_unread_poll_votes,
      id: messageId
    }),
    ...messageContainsUnreadPollVotesChanges(update)
  ]);
}
