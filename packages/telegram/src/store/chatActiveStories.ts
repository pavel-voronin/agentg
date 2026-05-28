import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database/client.js';
import { telegramChatActiveStories } from '../database/schema.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../tdlib/wire.js';

type TelegramWireChatActiveStories =
  TelegramWireUpdateByType<'updateChatActiveStories'>['active_stories'];

export async function storeChatActiveStories(
  database: TelegramDatabase,
  activeStories: TelegramWireChatActiveStories
): Promise<void> {
  const row = chatActiveStoriesRow(activeStories);

  await database.insert(telegramChatActiveStories).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChatActiveStories.chatId
  });
}

function chatActiveStoriesRow(
  activeStories: TelegramWireChatActiveStories
): typeof telegramChatActiveStories.$inferInsert {
  return {
    canBeArchived: activeStories.can_be_archived,
    chatId: String(activeStories.chat_id),
    list: telegramWireJsonValue(activeStories.list ?? null) ?? null,
    maxReadStoryId: activeStories.max_read_story_id,
    order: String(activeStories.order),
    stories: requiredTelegramWireJsonValue(activeStories.stories)
  };
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
