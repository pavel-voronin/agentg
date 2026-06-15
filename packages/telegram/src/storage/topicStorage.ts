import { eq } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramDirectMessagesChatTopics,
  telegramSavedMessagesTags,
  telegramSavedMessagesTopics
} from '../database/schema.js';
import type {
  DirectMessagesChatTopic,
  SavedMessagesTag,
  SavedMessagesTopic
} from '../domain/models/topic.js';

export async function saveSavedMessagesTopic(
  database: Database,
  topic: SavedMessagesTopic
): Promise<void> {
  await database.insert(telegramSavedMessagesTopics).values(topic).onConflictDoUpdate({
    set: topic,
    target: telegramSavedMessagesTopics.id
  });
}

export async function replaceSavedMessagesTags(
  database: Database,
  input: {
    records: readonly SavedMessagesTag[];
    savedMessagesTopicId: string;
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction
      .delete(telegramSavedMessagesTags)
      .where(eq(telegramSavedMessagesTags.savedMessagesTopicId, input.savedMessagesTopicId));

    if (input.records.length > 0) {
      await transaction.insert(telegramSavedMessagesTags).values([...input.records]);
    }
  });
}

export async function saveDirectMessagesChatTopic(
  database: Database,
  topic: DirectMessagesChatTopic
): Promise<void> {
  await database
    .insert(telegramDirectMessagesChatTopics)
    .values(topic)
    .onConflictDoUpdate({
      set: topic,
      target: [telegramDirectMessagesChatTopics.chatId, telegramDirectMessagesChatTopics.id]
    });
}
