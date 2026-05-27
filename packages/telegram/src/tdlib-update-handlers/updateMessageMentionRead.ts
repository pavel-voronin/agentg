import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import { upsertTelegramMessageFragment } from '../telegram-store/message.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireMessageMentionReadUpdate = TelegramWireUpdateByType<'updateMessageMentionRead'>;

export async function handleUpdateMessageMentionRead(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageMentionReadUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await upsertTelegramMessageFragment(database, {
    chatId,
    containsUnreadMention: false,
    id: messageId
  });

  await upsertTelegramChatFragment(database, {
    id: chatId,
    unreadMentionCount: update.unread_mention_count
  });

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
