import type { TelegramPayload } from './payload.js';

export type ForumTopic = {
  chatId: string;
  draftMessage: TelegramPayload | null;
  forumTopicId: number;
  isPinned: boolean;
  lastReadInboxMessageId: string | undefined;
  lastReadOutboxMessageId: string | undefined;
  notificationSettings: TelegramPayload;
  unreadMentionCount: number;
  unreadPollVoteCount: number;
  unreadReactionCount: number;
};

export type ForumTopicInfo = {
  chatId: string;
  creationDate: Date;
  creatorId: TelegramPayload;
  forumTopicId: number;
  icon: TelegramPayload;
  isClosed: boolean;
  isGeneral: boolean;
  isHidden: boolean;
  isNameImplicit: boolean;
  isOutgoing: boolean;
  name: string;
};

export type GroupCall = {
  areMessagesAllowed: boolean;
  canBeManaged: boolean;
  canDeleteMessages: boolean;
  canEnableVideo: boolean;
  canSendMessages: boolean;
  canToggleAreMessagesAllowed: boolean;
  canToggleMuteNewParticipants: boolean;
  duration: number;
  enabledStartNotification: boolean;
  hasHiddenListeners: boolean;
  id: number;
  inviteLink: string;
  isActive: boolean;
  isJoined: boolean;
  isLiveStory: boolean;
  isMyVideoEnabled: boolean;
  isMyVideoPaused: boolean;
  isOwned: boolean;
  isRtmpStream: boolean;
  isVideoChat: boolean;
  isVideoRecorded: boolean;
  loadedAllParticipants: boolean;
  messageSenderId: TelegramPayload | null;
  muteNewParticipants: boolean;
  needRejoin: boolean;
  paidMessageStarCount: string;
  participantCount: number;
  recentSpeakers: TelegramPayload;
  recordDuration: number | null | undefined;
  scheduledStartDate: Date;
  title: string;
  uniqueId: string;
};

export type GroupCallMessageState = {
  canBeDeleted?: boolean | null | undefined;
  date?: Date | null | undefined;
  error?: TelegramPayload | null | undefined;
  groupCallId: number;
  isFromOwner?: boolean | null | undefined;
  messageId: number;
  paidMessageStarCount?: string | null | undefined;
  senderId?: TelegramPayload | null | undefined;
  text?: TelegramPayload | null | undefined;
};

export type GroupCallParticipant = {
  audioSourceId: number;
  bio: string;
  canBeMutedForAllUsers: boolean;
  canBeMutedForCurrentUser: boolean;
  canBeUnmutedForAllUsers: boolean;
  canBeUnmutedForCurrentUser: boolean;
  canUnmuteSelf: boolean;
  groupCallId: number;
  isCurrentUser: boolean;
  isHandRaised: boolean;
  isMutedForAllUsers: boolean;
  isMutedForCurrentUser: boolean;
  isSpeaking: boolean;
  order: string;
  participantId: string;
  screenSharingAudioSourceId: number;
  screenSharingVideoInfo: TelegramPayload | null;
  videoInfo: TelegramPayload | null;
  volumeLevel: number;
};

export type GroupCallEncryptedParticipantUsers = {
  groupCallId: number;
  participantUserIds: TelegramPayload;
};

export type GroupCallVerificationState = {
  emojis: TelegramPayload;
  generation: number;
  groupCallId: number;
};

export type LanguagePackString = {
  key: string;
  languagePackId: string;
  localizationTarget: string;
  value: TelegramPayload | undefined;
};

export type LiveStoryDonors = {
  groupCallId: number;
  topDonors: TelegramPayload;
  totalStarCount: string;
};

export type ManagedBot = {
  botUserId: string;
  creatorUserId: string;
};
