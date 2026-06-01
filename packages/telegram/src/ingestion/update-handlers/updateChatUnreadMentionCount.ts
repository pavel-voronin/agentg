import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatUnreadMentionCountUpdate = UpdateByType<'updateChatUnreadMentionCount'>;

export async function handleUpdateChatUnreadMentionCount(
  update: ChatUnreadMentionCountUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadMentionCount: update.unread_mention_count
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
