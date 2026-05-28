import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { upsertTelegramMessageFragment } from '../../store/message.js';

type TelegramWireMessageContainsUnreadPollVotesUpdate = {
  _: 'updateMessageContainsUnreadPollVotes';
  chat_id: number | string;
  contains_unread_poll_votes: boolean;
  message_id: number | string;
  unread_poll_vote_count: number;
};

export async function handleUpdateMessageContainsUnreadPollVotes(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageContainsUnreadPollVotesUpdate
): Promise<void> {
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
