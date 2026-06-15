import { and, eq } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramStories } from '../database/schema.js';
import type { StoryIdentity, StoryState } from '../domain/models/story.js';

export type StoryStorageRow = typeof telegramStories.$inferInsert;

export async function saveStoryState(database: Database, story: StoryState): Promise<void> {
  const row = storyStorageRow(story);
  await database
    .insert(telegramStories)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramStories.posterChatId, telegramStories.id]
    });
}

export async function deleteStoryState(database: Database, story: StoryIdentity): Promise<void> {
  await database
    .delete(telegramStories)
    .where(
      and(
        eq(telegramStories.posterChatId, story.posterChatId),
        eq(telegramStories.id, story.storyId)
      )
    );
}

function storyStorageRow(story: StoryState): StoryStorageRow {
  return story;
}
