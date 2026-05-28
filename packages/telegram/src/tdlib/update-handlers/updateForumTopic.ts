import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { telegramForumTopics } from '../../database/schema.js';
import {
  telegramWireId,
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireUpdateByType
} from '../wire.js';

type TelegramWireForumTopicUpdate = TelegramWireUpdateByType<'updateForumTopic'>;

export async function handleUpdateForumTopic(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireForumTopicUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramForumTopicState(database, update);
  events.publishTelegramForumTopicUpdated({
    chatId,
    forumTopicId: update.forum_topic_id
  });
}

async function upsertTelegramForumTopicState(
  database: TelegramUpdateHandlerContext['database'],
  update: TelegramWireForumTopicUpdate
): Promise<void> {
  const row: typeof telegramForumTopics.$inferInsert = {
    chatId: String(update.chat_id),
    draftMessage: telegramWireJsonValue(update.draft_message ?? null) ?? null,
    forumTopicId: update.forum_topic_id,
    isPinned: update.is_pinned,
    lastReadInboxMessageId: telegramWireId(update.last_read_inbox_message_id),
    lastReadOutboxMessageId: telegramWireId(update.last_read_outbox_message_id),
    notificationSettings: telegramWireJsonObject(update.notification_settings),
    unreadMentionCount: update.unread_mention_count,
    unreadPollVoteCount: update.unread_poll_vote_count,
    unreadReactionCount: update.unread_reaction_count
  };

  await database
    .insert(telegramForumTopics)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramForumTopics.chatId, telegramForumTopics.forumTopicId]
    });
}
