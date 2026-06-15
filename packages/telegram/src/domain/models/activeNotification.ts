import type { TelegramPayload } from './payload.js';

import type { MessageState } from './messageState.js';

export type ActiveNotificationGroupState = {
  chatId: string;
  id: number;
  notificationSettingsChatId: string | null;
  notificationSoundId: string | null;
  totalCount: number;
  type: string;
};

export type ActiveNotification = {
  callId: number | null;
  date: Date;
  groupId: number;
  id: number;
  isSilent: boolean;
  messageChatId: string | null;
  messageId: string | null;
  pushContent: TelegramPayload | null;
  pushIsOutgoing: boolean | null;
  pushMessageId: string | null;
  pushSenderId: TelegramPayload | null;
  pushSenderName: string | null;
  showPreview: boolean | null;
  type: string;
};

export type ActiveNotificationSnapshot = {
  groups: ActiveNotificationGroupState[];
  messages: MessageState[];
  notifications: ActiveNotification[];
};

export type ActiveNotificationGroupUpdate = {
  addedMessages: MessageState[];
  addedNotifications: ActiveNotification[];
  group: ActiveNotificationGroupState;
  removedNotificationIds: number[];
};
