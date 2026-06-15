import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatUnreadReactionCountUpdate = UpdateByType<'updateChatUnreadReactionCount'>;

export async function handleUpdateChatUnreadReactionCount(
  update: ChatUnreadReactionCountUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadReactionCount: update.unread_reaction_count
  });
}
