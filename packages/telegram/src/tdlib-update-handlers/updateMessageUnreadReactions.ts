import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import { upsertTelegramMessageFragment } from '../telegram-store/message.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../telegramWire.js';

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
