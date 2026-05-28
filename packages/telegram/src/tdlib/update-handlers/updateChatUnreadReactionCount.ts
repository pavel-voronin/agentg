import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatUnreadReactionCountUpdate =
  TelegramWireUpdateByType<'updateChatUnreadReactionCount'>;

export async function handleUpdateChatUnreadReactionCount(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatUnreadReactionCountUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadReactionCount: update.unread_reaction_count
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
