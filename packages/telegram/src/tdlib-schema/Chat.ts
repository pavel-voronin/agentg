import type { JsonObject, JsonValue } from '@agentg/events/json';
import { z } from 'zod';

import {
  tdlibIdSchema,
  tdlibIdString,
  tdlibJsonObject,
  tdlibJsonValue,
  tdlibObjectSchema,
  type TdlibObject
} from './common.js';
import { tdlibMessage, type TdlibMessage } from './Message.js';

const tdlibChatInputSchema = z.looseObject({
  _: z.literal('chat'),
  id: tdlibIdSchema,
  is_marked_as_unread: z.optional(z.boolean()),
  last_message: z.optional(z.unknown()),
  last_read_inbox_message_id: z.optional(tdlibIdSchema),
  last_read_outbox_message_id: z.optional(tdlibIdSchema),
  notification_settings: z.optional(z.unknown()),
  photo: z.optional(z.unknown()),
  positions: z.optional(z.unknown()),
  title: z.optional(z.string()),
  type: z.optional(tdlibObjectSchema),
  unread_count: z.optional(z.number().int())
});

type TdlibChatInput = z.infer<typeof tdlibChatInputSchema>;

const tdlibChatsInputSchema = z
  .strictObject({
    _: z.literal('chats'),
    chat_ids: z.array(z.number().int()),
    total_count: z.optional(z.number().int())
  })
  .transform((input) => ({
    _: input._,
    chat_ids: input.chat_ids,
    ...(input.total_count === undefined ? {} : { total_count: input.total_count })
  }));

export type TdlibChat = {
  chat: JsonObject;
  id: string;
  isMarkedAsUnread?: boolean | undefined;
  lastMessage?: TdlibMessage | null | undefined;
  lastReadInboxMessageId?: string | undefined;
  lastReadOutboxMessageId?: string | undefined;
  notificationSettings?: JsonValue | undefined;
  photo?: JsonValue | undefined;
  positions?: JsonValue | undefined;
  title: string;
  type: string;
  typeObject: TdlibObject;
  unreadCount?: number | undefined;
};

export type TdlibChats = {
  _: 'chats';
  chat_ids: number[];
  total_count?: number | undefined;
};

export const tdlibChatSchema = tdlibChatInputSchema.transform(buildTdlibChat);
export const tdlibChatsSchema = tdlibChatsInputSchema;

export function tdlibChat(input: unknown): TdlibChat {
  return tdlibChatSchema.parse(input);
}

export function tdlibChats(input: unknown): TdlibChats {
  return tdlibChatsSchema.parse(input);
}

function buildTdlibChat(chat: TdlibChatInput): TdlibChat {
  const typeObject = tdlibChatTypeObject(chat.type);
  return {
    chat: tdlibJsonObject(chat),
    id: String(chat.id),
    isMarkedAsUnread: chat.is_marked_as_unread,
    lastMessage:
      chat.last_message === null || chat.last_message === undefined
        ? chat.last_message
        : tdlibMessage(chat.last_message),
    lastReadInboxMessageId: tdlibIdString(chat.last_read_inbox_message_id),
    lastReadOutboxMessageId: tdlibIdString(chat.last_read_outbox_message_id),
    notificationSettings: tdlibJsonValue(chat.notification_settings),
    photo: tdlibJsonValue(chat.photo),
    positions: tdlibJsonValue(chat.positions),
    title: chat.title ?? '',
    type: chatType(typeObject),
    typeObject,
    unreadCount: chat.unread_count
  };
}

function chatType(value: TdlibObject): string {
  if (value._ === 'chatTypePrivate') {
    return 'private';
  }

  if (value._ === 'chatTypeSecret') {
    return 'secret';
  }

  if (value._ === 'chatTypeBasicGroup') {
    return 'group';
  }

  if (value._ === 'chatTypeSupergroup') {
    return value.is_channel === true || value.isChannel === true ? 'channel' : 'group';
  }

  return value._;
}

function tdlibChatTypeObject(
  value: { _: string; [key: string]: unknown } | undefined
): TdlibObject {
  return value === undefined ? { _: 'unknown' } : tdlibJsonObject(value);
}
