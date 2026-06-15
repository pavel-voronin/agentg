import { upsertTelegramChatFragment } from '../../store/chat.js';
import { upsertTelegramMessageFragment } from '../../store/message.js';
import { tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type MessageUnreadReactionsUpdate = UpdateByType<'updateMessageUnreadReactions'>;

export async function handleUpdateMessageUnreadReactions(
  update: MessageUnreadReactionsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await upsertTelegramMessageFragment(database, {
    chatId,
    id: messageId,
    unreadReactions: tdJsonValue(update.unread_reactions)
  });

  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadReactionCount: update.unread_reaction_count
  });
}
