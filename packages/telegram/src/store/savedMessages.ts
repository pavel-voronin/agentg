import { eq } from 'drizzle-orm';

import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramSavedMessagesTags, telegramSavedMessagesTopics } from '../database/schema.js';
import { tdJsonObject, tdJsonValue, type UpdateByType } from '../tdlib/value.js';
import { reactionTypeKey } from './reaction.js';

type SavedMessagesTagsUpdate = UpdateByType<'updateSavedMessagesTags'>;
type SavedMessagesTopic = UpdateByType<'updateSavedMessagesTopic'>['topic'];

export async function replaceSavedMessagesTags(
  database: Database,
  update: SavedMessagesTagsUpdate
): Promise<void> {
  const savedMessagesTopicId = String(update.saved_messages_topic_id);

  await database.transaction(async (transaction) => {
    await transaction
      .delete(telegramSavedMessagesTags)
      .where(eq(telegramSavedMessagesTags.savedMessagesTopicId, savedMessagesTopicId));

    const rows = update.tags.tags.map((tag) => ({
      count: tag.count,
      label: tag.label,
      savedMessagesTopicId,
      tag: reactionTypeKey(tag.tag)
    }));

    if (rows.length > 0) {
      await transaction.insert(telegramSavedMessagesTags).values(rows);
    }
  });
}

export async function upsertSavedMessagesTopic(
  database: Database,
  topic: SavedMessagesTopic
): Promise<void> {
  const lastMessage = topic.last_message ?? null;
  const row: typeof telegramSavedMessagesTopics.$inferInsert = {
    draftMessage: requiredJsonValue(topic.draft_message ?? null),
    id: String(topic.id),
    isPinned: topic.is_pinned,
    lastMessageChatId: lastMessage === null ? null : String(lastMessage.chat_id),
    lastMessageId: lastMessage === null ? null : String(lastMessage.id),
    order: topic.order,
    type: tdJsonObject(topic.type)
  };

  await database.insert(telegramSavedMessagesTopics).values(row).onConflictDoUpdate({
    set: row,
    target: telegramSavedMessagesTopics.id
  });
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
