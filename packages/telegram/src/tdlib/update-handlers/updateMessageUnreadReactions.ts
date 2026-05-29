import { upsertTelegramChatFragment } from '../../store/chat.js';
import { upsertTelegramMessageFragment } from '../../store/message.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireMessageUnreadReactionsUpdate =
  TelegramWireUpdateByType<'updateMessageUnreadReactions'>;

export async function handleUpdateMessageUnreadReactions(
  update: TelegramWireMessageUnreadReactionsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await upsertTelegramMessageFragment(database, {
    chatId,
    id: messageId,
    unreadReactions: telegramWireJsonValue(update.unread_reactions)
  });

  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadReactionCount: update.unread_reaction_count
  });

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
