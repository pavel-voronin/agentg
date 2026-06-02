import { and, eq } from 'drizzle-orm';

import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramStories } from '../database/schema.js';
import { tdDate, tdJsonValue, type UpdateByType } from '../tdlib/value.js';

type Story = UpdateByType<'updateStory'>['story'];
type StoryFailureMetadata = {
  canPostStoryResult?: unknown;
  error?: unknown;
};

export async function upsertStory(
  database: Database,
  story: Story,
  failure: StoryFailureMetadata = {}
): Promise<void> {
  const row = storyRow(story, failure);

  await database
    .insert(telegramStories)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramStories.posterChatId, telegramStories.id]
    });
}

export async function deleteStory(
  database: Database,
  input: {
    posterChatId: string;
    storyId: number;
  }
): Promise<void> {
  await database
    .delete(telegramStories)
    .where(
      and(
        eq(telegramStories.posterChatId, input.posterChatId),
        eq(telegramStories.id, input.storyId)
      )
    );
}

function storyRow(
  story: Story,
  failure: StoryFailureMetadata
): typeof telegramStories.$inferInsert {
  const date = tdDate(story.date);
  if (date === undefined) {
    throw new Error('Expected story date');
  }

  return {
    albumIds: requiredJsonValue(story.album_ids),
    areas: requiredJsonValue(story.areas),
    canBeAddedToAlbum: story.can_be_added_to_album,
    canBeDeleted: story.can_be_deleted,
    canBeEdited: story.can_be_edited,
    canBeForwarded: story.can_be_forwarded,
    canBeReplied: story.can_be_replied,
    canGetInteractions: story.can_get_interactions,
    canGetStatistics: story.can_get_statistics,
    canPostStoryResult: nullableJsonValue(failure.canPostStoryResult ?? null),
    canSetPrivacySettings: story.can_set_privacy_settings,
    canToggleIsPostedToChatPage: story.can_toggle_is_posted_to_chat_page,
    caption: requiredJsonValue(story.caption),
    chosenReactionType: requiredJsonValue(story.chosen_reaction_type ?? null),
    content: requiredJsonValue(story.content),
    date,
    error: nullableJsonValue(failure.error ?? null),
    hasExpiredViewers: story.has_expired_viewers,
    id: story.id,
    interactionInfo: requiredJsonValue(story.interaction_info ?? null),
    isBeingEdited: story.is_being_edited,
    isBeingPosted: story.is_being_posted,
    isEdited: story.is_edited,
    isPostedToChatPage: story.is_posted_to_chat_page,
    isVisibleOnlyForSelf: story.is_visible_only_for_self,
    posterChatId: String(story.poster_chat_id),
    posterId: requiredJsonValue(story.poster_id ?? null),
    privacySettings: requiredJsonValue(story.privacy_settings),
    repostInfo: requiredJsonValue(story.repost_info ?? null)
  };
}

function nullableJsonValue(value: unknown): JsonValue | null {
  return value === null ? null : requiredJsonValue(value);
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
