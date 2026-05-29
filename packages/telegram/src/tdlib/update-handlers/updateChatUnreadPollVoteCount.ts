import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatUnreadPollVoteCountUpdate =
  TelegramWireUpdateByType<'updateChatUnreadPollVoteCount'>;

export async function handleUpdateChatUnreadPollVoteCount(
  update: TelegramWireChatUnreadPollVoteCountUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadPollVoteCount: update.unread_poll_vote_count
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
