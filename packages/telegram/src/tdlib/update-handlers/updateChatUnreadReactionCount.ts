import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatUnreadReactionCountUpdate =
  TelegramWireUpdateByType<'updateChatUnreadReactionCount'>;

export async function handleUpdateChatUnreadReactionCount(
  update: TelegramWireChatUnreadReactionCountUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadReactionCount: update.unread_reaction_count
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
