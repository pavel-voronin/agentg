import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { upsertTelegramMessageFragment } from '../../store/message.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireMessageUnreadReactionsUpdate =
  TelegramWireUpdateByType<'updateMessageUnreadReactions'>;

export async function handleUpdateMessageUnreadReactions(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageUnreadReactionsUpdate
): Promise<void> {
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
