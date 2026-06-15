import type { TelegramPayload } from './payload.js';

export type SavedMessagesTopic = {
  draftMessage: TelegramPayload;
  id: string;
  isPinned: boolean;
  lastMessageChatId: string | null;
  lastMessageId: string | null;
  order: string;
  type: TelegramPayload;
};

export type SavedMessagesTag = {
  count: number;
  label: string;
  savedMessagesTopicId: string;
  tag: string;
};

export type DirectMessagesChatTopic = {
  canSendUnpaidMessages: boolean;
  chatId: string;
  draftMessage: TelegramPayload;
  id: string;
  isMarkedAsUnread: boolean;
  lastMessageChatId: string | null;
  lastMessageId: string | null;
  lastReadInboxMessageId: string;
  lastReadOutboxMessageId: string;
  order: string;
  senderId: TelegramPayload;
  unreadCount: string;
  unreadReactionCount: string;
};
