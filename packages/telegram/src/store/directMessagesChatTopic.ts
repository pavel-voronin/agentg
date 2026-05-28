import type { TelegramDatabase } from '../database.js';
import { telegramDirectMessagesChatTopics } from '../schema.js';
import {
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireUpdateByType
} from '../tdlib/wire.js';

type TelegramWireDirectMessagesChatTopic =
  TelegramWireUpdateByType<'updateDirectMessagesChatTopic'>['topic'];

export async function storeDirectMessagesChatTopic(
  database: TelegramDatabase,
  topic: TelegramWireDirectMessagesChatTopic
): Promise<void> {
  const lastMessage = topic.last_message ?? null;
  const row: typeof telegramDirectMessagesChatTopics.$inferInsert = {
    canSendUnpaidMessages: topic.can_send_unpaid_messages,
    chatId: String(topic.chat_id),
    draftMessage: telegramWireJsonValue(topic.draft_message ?? null) ?? null,
    id: String(topic.id),
    isMarkedAsUnread: topic.is_marked_as_unread,
    lastMessageChatId: lastMessage === null ? null : String(lastMessage.chat_id),
    lastMessageId: lastMessage === null ? null : String(lastMessage.id),
    lastReadInboxMessageId: String(topic.last_read_inbox_message_id),
    lastReadOutboxMessageId: String(topic.last_read_outbox_message_id),
    order: topic.order,
    senderId: telegramWireJsonObject(topic.sender_id),
    unreadCount: String(topic.unread_count),
    unreadReactionCount: String(topic.unread_reaction_count)
  };

  await database
    .insert(telegramDirectMessagesChatTopics)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramDirectMessagesChatTopics.chatId, telegramDirectMessagesChatTopics.id]
    });
}
