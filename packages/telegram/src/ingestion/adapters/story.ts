import type { JsonValue } from '@agentg/framework';

import type { DomainChange, StoryDeletedChange, StorySavedChange } from '../../domain/changes.js';
import type { StoryState } from '../../domain/models/story.js';
import { tdDate, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';

type StoryUpdate = UpdateByType<'updateStory'>;
type StoryDeletedUpdate = UpdateByType<'updateStoryDeleted'>;
type StoryPostFailedUpdate = UpdateByType<'updateStoryPostFailed'>;
type StoryPostSucceededUpdate = UpdateByType<'updateStoryPostSucceeded'>;
type Story = StoryUpdate['story'];
type StoryFailureMetadata = {
  canPostStoryResult?: unknown;
  error?: unknown;
};

export function storyChanges(update: StoryUpdate): DomainChange[] {
  return savedStoryChanges(update.story);
}

export function storyDeletedChanges(update: StoryDeletedUpdate): DomainChange[] {
  return deletedStoryChanges({
    posterChatId: String(update.story_poster_chat_id),
    storyId: update.story_id
  });
}

export function storyPostFailedChanges(update: StoryPostFailedUpdate): DomainChange[] {
  return savedStoryChanges(update.story, {
    canPostStoryResult: update.error_type ?? null,
    error: update.error
  });
}

export function storyPostSucceededChanges(update: StoryPostSucceededUpdate): DomainChange[] {
  const changes: DomainChange[] = [savedStoryChange(update.story)];
  if (update.old_story_id !== update.story.id) {
    changes.push({
      kind: 'story.deleted',
      story: {
        posterChatId: String(update.story.poster_chat_id),
        storyId: update.old_story_id
      }
    } satisfies StoryDeletedChange);
  }
  return changes;
}

function savedStoryChange(story: Story, failure: StoryFailureMetadata = {}): StorySavedChange {
  return {
    kind: 'story.saved',
    story: storyRecord(story, failure)
  };
}

export function savedStoryChanges(
  story: Story,
  failure: StoryFailureMetadata = {}
): DomainChange[] {
  return [savedStoryChange(story, failure)];
}

export function deletedStoryChanges(input: {
  posterChatId: string;
  storyId: number;
}): DomainChange[] {
  return [
    {
      kind: 'story.deleted',
      story: input
    } satisfies StoryDeletedChange
  ];
}

function storyRecord(story: Story, failure: StoryFailureMetadata): StoryState {
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
