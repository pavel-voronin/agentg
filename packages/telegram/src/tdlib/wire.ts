/// <reference types="@prebuilt-tdlib/types" />

import type { JsonObject, JsonValue } from '@agentg/events/json';
import { toJsonValue } from '@agentg/events/json';
import type {
  Update,
  chat,
  chats,
  file,
  message,
  messages,
  updateAuthorizationState,
  updateChatAddedToList,
  updateChatFolders,
  updateChatLastMessage,
  updateChatNotificationSettings,
  updateChatPosition,
  updateConnectionState,
  updateDeleteMessages,
  updateFile,
  updateMessageContent,
  updateNewChat,
  updateNewMessage,
  updateSupergroup,
  updateSupergroupFullInfo,
  updateUser,
  user
} from 'tdlib-types';

export type TelegramWireMessageContainsUnreadPollVotesUpdate = {
  _: 'updateMessageContainsUnreadPollVotes';
  chat_id: number | string;
  contains_unread_poll_votes: boolean;
  message_id: number | string;
  unread_poll_vote_count: number;
};

export type TelegramWireNewGuestQueryUpdate = {
  _: 'updateNewGuestQuery';
  id: string;
  message: message;
  reference_messages: message[];
};

export type TelegramWireUpdate =
  | Update
  | TelegramWireMessageContainsUnreadPollVotesUpdate
  | TelegramWireNewGuestQueryUpdate;
export type TelegramWireUpdateByType<Type extends TelegramWireUpdate['_']> = Extract<
  TelegramWireUpdate,
  { _: Type }
>;
export type TelegramWireAuthorizationStateUpdate = updateAuthorizationState;
export type TelegramWireChat = chat;
export type TelegramWireChatAddedToListUpdate = updateChatAddedToList;
export type TelegramWireChats = chats;
export type TelegramWireChatFoldersUpdate = updateChatFolders;
export type TelegramWireChatLastMessageUpdate = updateChatLastMessage;
export type TelegramWireChatNotificationSettingsUpdate = updateChatNotificationSettings;
export type TelegramWireChatPositionUpdate = updateChatPosition;
export type TelegramWireConnectionStateUpdate = updateConnectionState;
export type TelegramWireDeleteMessagesUpdate = updateDeleteMessages;
export type TelegramWireFile = file;
export type TelegramWireFileUpdate = updateFile;
export type TelegramWireMessage = message;
export type TelegramWireMessages = messages;
export type TelegramWireMessageContentUpdate = updateMessageContent;
export type TelegramWireNewChatUpdate = updateNewChat;
export type TelegramWireNewMessageUpdate = updateNewMessage;
export type TelegramWireObject = JsonObject & { _: string };
export type TelegramWireSupergroupFullInfoUpdate = updateSupergroupFullInfo;
export type TelegramWireSupergroupUpdate = updateSupergroup;
export type TelegramWireUser = user;
export type TelegramWireUserUpdate = updateUser;

export function telegramWireDate(value: number | undefined): Date | undefined {
  return value === undefined || value <= 0 ? undefined : new Date(value * 1000);
}

export function telegramWireId(value: number | string | null | undefined): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

export function telegramWireIdNumber(value: number | string | undefined): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?[0-9]+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function telegramWireJsonObject(value: unknown): TelegramWireObject {
  const json = toJsonValue(value);
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error('Expected Telegram wire object');
  }
  return json as TelegramWireObject;
}

export function telegramWireJsonValue(value: unknown): JsonValue | undefined {
  return value === undefined ? undefined : toJsonValue(value);
}

export function telegramWireFileOrUndefined(value: unknown): TelegramWireFile | undefined {
  const object = telegramWireObjectOrUndefined(value);
  if (object?._ !== 'file') {
    return undefined;
  }

  const local = telegramWireObjectOrUndefined(object.local);
  const remote = telegramWireObjectOrUndefined(object.remote);
  if (
    typeof object.id !== 'number' ||
    local?._ !== 'localFile' ||
    remote?._ !== 'remoteFile' ||
    typeof remote.id !== 'string'
  ) {
    return undefined;
  }

  return value as TelegramWireFile;
}

function telegramWireObjectOrUndefined(value: unknown): TelegramWireObject | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return typeof record._ === 'string' ? telegramWireJsonObject(record) : undefined;
}
