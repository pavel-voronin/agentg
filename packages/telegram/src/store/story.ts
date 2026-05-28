import { and, eq } from 'drizzle-orm';

import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramStories } from '../schema.js';
import {
  telegramWireDate,
  telegramWireJsonValue,
  type TelegramWireUpdateByType
} from '../tdlib/wire.js';

type TelegramWireStory = TelegramWireUpdateByType<'updateStory'>['story'];
type StoryFailureMetadata = {
  canPostStoryResult?: unknown;
  error?: unknown;
};

export async function upsertStory(
  database: TelegramDatabase,
  story: TelegramWireStory,
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
  database: TelegramDatabase,
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
  story: TelegramWireStory,
  failure: StoryFailureMetadata
): typeof telegramStories.$inferInsert {
  const date = telegramWireDate(story.date);
  if (date === undefined) {
    throw new Error('Expected story date');
  }

  return {
    albumIds: requiredTelegramWireJsonValue(story.album_ids),
    areas: requiredTelegramWireJsonValue(story.areas),
    canBeAddedToAlbum: story.can_be_added_to_album,
    canBeDeleted: story.can_be_deleted,
    canBeEdited: story.can_be_edited,
    canBeForwarded: story.can_be_forwarded,
    canBeReplied: story.can_be_replied,
    canGetInteractions: story.can_get_interactions,
    canGetStatistics: story.can_get_statistics,
    canPostStoryResult: nullableTelegramWireJsonValue(failure.canPostStoryResult ?? null),
    canSetPrivacySettings: story.can_set_privacy_settings,
    canToggleIsPostedToChatPage: story.can_toggle_is_posted_to_chat_page,
    caption: requiredTelegramWireJsonValue(story.caption),
    chosenReactionType: requiredTelegramWireJsonValue(story.chosen_reaction_type ?? null),
    content: requiredTelegramWireJsonValue(story.content),
    date,
    error: nullableTelegramWireJsonValue(failure.error ?? null),
    hasExpiredViewers: story.has_expired_viewers,
    id: story.id,
    interactionInfo: requiredTelegramWireJsonValue(story.interaction_info ?? null),
    isBeingEdited: story.is_being_edited,
    isBeingPosted: story.is_being_posted,
    isEdited: story.is_edited,
    isPostedToChatPage: story.is_posted_to_chat_page,
    isVisibleOnlyForSelf: story.is_visible_only_for_self,
    posterChatId: String(story.poster_chat_id),
    posterId: requiredTelegramWireJsonValue(story.poster_id ?? null),
    privacySettings: requiredTelegramWireJsonValue(story.privacy_settings),
    repostInfo: requiredTelegramWireJsonValue(story.repost_info ?? null)
  };
}

function nullableTelegramWireJsonValue(value: unknown): JsonValue | null {
  return value === null ? null : requiredTelegramWireJsonValue(value);
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
