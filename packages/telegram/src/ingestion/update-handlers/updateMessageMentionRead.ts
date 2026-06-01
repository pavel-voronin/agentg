import { upsertTelegramChatFragment } from '../../store/chat.js';
import { upsertTelegramMessageFragment } from '../../store/message.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type MessageMentionReadUpdate = UpdateByType<'updateMessageMentionRead'>;

export async function handleUpdateMessageMentionRead(
  update: MessageMentionReadUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
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
