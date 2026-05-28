import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatUnreadPollVoteCountUpdate =
  TelegramWireUpdateByType<'updateChatUnreadPollVoteCount'>;

export async function handleUpdateChatUnreadPollVoteCount(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatUnreadPollVoteCountUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadPollVoteCount: update.unread_poll_vote_count
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
