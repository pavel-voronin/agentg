import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { upsertTelegramMessageFragment } from '../../store/message.js';
import type { TelegramWireUpdateByType } from '../wire.js';

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
