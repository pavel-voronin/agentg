import { telegramForumTopics } from '../../database/schema.js';
import type { Database } from '../../database/client.js';
import { tdId, tdJsonObject, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ForumTopicUpdate = UpdateByType<'updateForumTopic'>;

export async function handleUpdateForumTopic(
  update: ForumTopicUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await upsertTelegramForumTopicState(database, update);
}

async function upsertTelegramForumTopicState(
  database: Database,
  update: ForumTopicUpdate
): Promise<void> {
  const row: typeof telegramForumTopics.$inferInsert = {
    chatId: String(update.chat_id),
    draftMessage: tdJsonValue(update.draft_message ?? null) ?? null,
    forumTopicId: update.forum_topic_id,
    isPinned: update.is_pinned,
    lastReadInboxMessageId: tdId(update.last_read_inbox_message_id),
    lastReadOutboxMessageId: tdId(update.last_read_outbox_message_id),
    notificationSettings: tdJsonObject(update.notification_settings),
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
