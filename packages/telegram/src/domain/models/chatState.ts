import type { TelegramPayload } from './payload.js';

export type ChatState = {
  accentColorId?: number | null | undefined;
  actionBar?: TelegramPayload | undefined;
  availableReactions?: TelegramPayload | undefined;
  background?: TelegramPayload | undefined;
  backgroundCustomEmojiId?: string | null | undefined;
  blockList?: TelegramPayload | undefined;
  businessBotManageBar?: TelegramPayload | undefined;
  canBeDeletedForAllUsers?: boolean | null | undefined;
  canBeDeletedOnlyForSelf?: boolean | null | undefined;
  canBeReported?: boolean | null | undefined;
  chatLists?: TelegramPayload | undefined;
  clientData?: string | null | undefined;
  defaultDisableNotification?: boolean | null | undefined;
  draftMessage?: TelegramPayload | undefined;
  emojiStatus?: TelegramPayload | undefined;
  hasProtectedContent?: boolean | null | undefined;
  hasScheduledMessages?: boolean | null | undefined;
  id: string;
  isMarkedAsUnread?: boolean | null | undefined;
  isTranslatable?: boolean | null | undefined;
  lastMessageChatId?: string | null | undefined;
  lastMessageId?: string | null | undefined;
  lastReadInboxMessageId?: string | null | undefined;
  lastReadOutboxMessageId?: string | null | undefined;
  messageAutoDeleteTime?: number | null | undefined;
  messageSenderId?: TelegramPayload | undefined;
  notificationSettings?: TelegramPayload | undefined;
  pendingJoinRequests?: TelegramPayload | undefined;
  permissions?: TelegramPayload | undefined;
  photo?: TelegramPayload | undefined;
  profileAccentColorId?: number | null | undefined;
  profileBackgroundCustomEmojiId?: string | null | undefined;
  replyMarkupMessageId?: string | null | undefined;
  theme?: TelegramPayload | undefined;
  title?: string | null | undefined;
  type?: TelegramPayload | undefined;
  unreadCount?: number | null | undefined;
  unreadMentionCount?: number | null | undefined;
  unreadPollVoteCount?: number | null | undefined;
  unreadReactionCount?: number | null | undefined;
  upgradedGiftColors?: TelegramPayload | undefined;
  videoChat?: TelegramPayload | undefined;
  viewAsTopics?: boolean | null | undefined;
};

export type ChatPatch = Partial<ChatState> & Pick<ChatState, 'id'>;

export type ChatPositionState = {
  chatId: string;
  isPinned: boolean;
  listKey: string;
  order: string;
  source?: TelegramPayload | undefined;
};

export type ChatListMembership = {
  chatId: string;
  chatList: TelegramPayload;
  listKey: string;
};
