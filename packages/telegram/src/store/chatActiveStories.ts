import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramChatActiveStories } from '../database/schema.js';
import { tdJsonValue, type UpdateByType } from '../tdlib/shape.js';

type ChatActiveStories = UpdateByType<'updateChatActiveStories'>['active_stories'];

export async function storeChatActiveStories(
  database: Database,
  activeStories: ChatActiveStories
): Promise<void> {
  const row = chatActiveStoriesRow(activeStories);

  await database.insert(telegramChatActiveStories).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChatActiveStories.chatId
  });
}

function chatActiveStoriesRow(
  activeStories: ChatActiveStories
): typeof telegramChatActiveStories.$inferInsert {
  return {
    canBeArchived: activeStories.can_be_archived,
    chatId: String(activeStories.chat_id),
    list: tdJsonValue(activeStories.list ?? null) ?? null,
    maxReadStoryId: activeStories.max_read_story_id,
    order: String(activeStories.order),
    stories: requiredJsonValue(activeStories.stories)
  };
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
