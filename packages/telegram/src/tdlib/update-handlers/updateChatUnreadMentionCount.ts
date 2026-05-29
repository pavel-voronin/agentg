import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatUnreadMentionCountUpdate =
  TelegramWireUpdateByType<'updateChatUnreadMentionCount'>;

export async function handleUpdateChatUnreadMentionCount(
  update: TelegramWireChatUnreadMentionCountUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadMentionCount: update.unread_mention_count
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
