import { eq } from 'drizzle-orm';

import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramSavedMessagesTags, telegramSavedMessagesTopics } from '../schema.js';
import {
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireUpdateByType
} from '../tdlib/wire.js';
import { reactionTypeKey } from './reaction.js';

type TelegramWireSavedMessagesTagsUpdate = TelegramWireUpdateByType<'updateSavedMessagesTags'>;
type TelegramWireSavedMessagesTopic = TelegramWireUpdateByType<'updateSavedMessagesTopic'>['topic'];

export async function replaceSavedMessagesTags(
  database: TelegramDatabase,
  update: TelegramWireSavedMessagesTagsUpdate
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
  database: TelegramDatabase,
  topic: TelegramWireSavedMessagesTopic
): Promise<void> {
  const lastMessage = topic.last_message ?? null;
  const row: typeof telegramSavedMessagesTopics.$inferInsert = {
    draftMessage: requiredTelegramWireJsonValue(topic.draft_message ?? null),
    id: String(topic.id),
    isPinned: topic.is_pinned,
    lastMessageChatId: lastMessage === null ? null : String(lastMessage.chat_id),
    lastMessageId: lastMessage === null ? null : String(lastMessage.id),
    order: topic.order,
    type: telegramWireJsonObject(topic.type)
  };

  await database.insert(telegramSavedMessagesTopics).values(row).onConflictDoUpdate({
    set: row,
    target: telegramSavedMessagesTopics.id
  });
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
