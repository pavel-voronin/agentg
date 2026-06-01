import { upsertTelegramChatFragment } from '../../store/chat.js';
import { upsertTelegramMessageFragment } from '../../store/message.js';
import type { IngestionResources } from '../resources.js';
import type { MessageContainsUnreadPollVotesUpdate } from '../types.js';

export async function handleUpdateMessageContainsUnreadPollVotes(
  update: MessageContainsUnreadPollVotesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await upsertTelegramMessageFragment(database, {
    chatId,
    containsUnreadPollVotes: update.contains_unread_poll_votes,
    id: messageId
  });

  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadPollVoteCount: update.unread_poll_vote_count
  });

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
