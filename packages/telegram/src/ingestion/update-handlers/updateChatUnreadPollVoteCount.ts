import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatUnreadPollVoteCountUpdate = UpdateByType<'updateChatUnreadPollVoteCount'>;

export async function handleUpdateChatUnreadPollVoteCount(
  update: ChatUnreadPollVoteCountUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadPollVoteCount: update.unread_poll_vote_count
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
