import type { TelegramPayload } from './payload.js';

export type StoryState = {
  albumIds: TelegramPayload;
  areas: TelegramPayload;
  canBeAddedToAlbum: boolean;
  canBeDeleted: boolean;
  canBeEdited: boolean;
  canBeForwarded: boolean;
  canBeReplied: boolean;
  canGetInteractions: boolean;
  canGetStatistics: boolean;
  canPostStoryResult: TelegramPayload | null;
  canSetPrivacySettings: boolean;
  canToggleIsPostedToChatPage: boolean;
  caption: TelegramPayload;
  chosenReactionType: TelegramPayload;
  content: TelegramPayload;
  date: Date;
  error: TelegramPayload | null;
  hasExpiredViewers: boolean;
  id: number;
  interactionInfo: TelegramPayload;
  isBeingEdited: boolean;
  isBeingPosted: boolean;
  isEdited: boolean;
  isPostedToChatPage: boolean;
  isVisibleOnlyForSelf: boolean;
  posterChatId: string;
  posterId: TelegramPayload;
  privacySettings: TelegramPayload;
  repostInfo: TelegramPayload;
};

export type StoryIdentity = {
  posterChatId: string;
  storyId: number;
};
