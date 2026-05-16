import type { JsonObject, JsonValue } from '@agentg/events/json';
import { z } from 'zod';

import {
  tdlibDate,
  tdlibIdSchema,
  tdlibIdString,
  tdlibJsonObject,
  tdlibJsonValue,
  tdlibObjectSchema,
  type TdlibObject
} from './common.js';

export type TelegramMessageTextEntity = {
  kind: 'textUrl' | 'url';
  length: number;
  offset: number;
  url: string;
};

export type TelegramMessageServiceAction = {
  kind: 'chatMemberLeft';
  userId: string;
};

const tdlibMessageInputSchema = z.strictObject({
  _: z.literal('message'),
  author_signature: z.optional(z.string()),
  auto_delete_in: z.optional(z.number()),
  can_be_saved: z.optional(z.boolean()),
  chat_id: tdlibIdSchema,
  contains_unread_mention: z.optional(z.boolean()),
  contains_unread_poll_votes: z.optional(z.boolean()),
  content: tdlibObjectSchema,
  date: z.optional(z.number()),
  edit_date: z.optional(z.number()),
  effect_id: z.optional(tdlibIdSchema),
  fact_check: z.optional(z.unknown()),
  forward_info: z.optional(z.unknown()),
  guest_bot_caller_id: z.optional(z.unknown()),
  has_timestamped_media: z.optional(z.boolean()),
  id: tdlibIdSchema,
  import_info: z.optional(z.unknown()),
  is_channel_post: z.optional(z.boolean()),
  is_from_offline: z.optional(z.boolean()),
  is_outgoing: z.optional(z.boolean()),
  is_paid_star_suggested_post: z.optional(z.boolean()),
  is_paid_ton_suggested_post: z.optional(z.boolean()),
  is_pinned: z.optional(z.boolean()),
  interaction_info: z.optional(z.unknown()),
  media_album_id: z.optional(tdlibIdSchema),
  paid_message_star_count: z.optional(tdlibIdSchema),
  reply_markup: z.optional(z.unknown()),
  reply_to: z.optional(z.unknown()),
  restriction_info: z.optional(z.unknown()),
  scheduling_state: z.optional(z.unknown()),
  self_destruct_in: z.optional(z.number()),
  self_destruct_type: z.optional(z.unknown()),
  sender_business_bot_user_id: z.optional(tdlibIdSchema),
  sender_boost_count: z.optional(z.number().int()),
  sender_id: z.optional(tdlibObjectSchema),
  sender_tag: z.optional(z.string()),
  sending_state: z.optional(z.unknown()),
  summary_language_code: z.optional(z.string()),
  suggested_post_info: z.optional(z.unknown()),
  topic_id: z.optional(z.unknown()),
  unread_reactions: z.optional(z.unknown()),
  via_bot_user_id: z.optional(tdlibIdSchema)
});

type TdlibMessageInput = z.infer<typeof tdlibMessageInputSchema>;

const tdlibMessagesInputSchema = z
  .strictObject({
    _: z.literal('messages'),
    messages: z.array(z.unknown()),
    total_count: z.optional(z.number().int())
  })
  .transform((input) => ({
    _: input._,
    messages: input.messages.map(tdlibMessage),
    ...(input.total_count === undefined ? {} : { total_count: input.total_count })
  }));

export type TdlibSender = TdlibObject & {
  chat_id?: string | undefined;
  user_id?: string | undefined;
};

export type TdlibMessage = Omit<
  TdlibMessageInput,
  | 'chat_id'
  | 'content'
  | 'date'
  | 'edit_date'
  | 'effect_id'
  | 'fact_check'
  | 'forward_info'
  | 'guest_bot_caller_id'
  | 'id'
  | 'import_info'
  | 'interaction_info'
  | 'media_album_id'
  | 'paid_message_star_count'
  | 'reply_markup'
  | 'reply_to'
  | 'restriction_info'
  | 'scheduling_state'
  | 'self_destruct_type'
  | 'sender_business_bot_user_id'
  | 'sender_id'
  | 'sending_state'
  | 'suggested_post_info'
  | 'topic_id'
  | 'unread_reactions'
  | 'via_bot_user_id'
> & {
  chat_id: string;
  content: TdlibObject;
  date?: Date | undefined;
  edit_date?: Date | undefined;
  effect_id?: string | undefined;
  fact_check?: JsonValue | undefined;
  forward_info?: JsonValue | undefined;
  guest_bot_caller_id?: JsonValue | undefined;
  id: string;
  import_info?: JsonValue | undefined;
  interaction_info?: JsonValue | undefined;
  media_album_id?: string | undefined;
  paid_message_star_count?: string | undefined;
  message: JsonObject;
  reply_markup?: JsonValue | undefined;
  reply_to?: JsonValue | undefined;
  restriction_info?: JsonValue | undefined;
  scheduling_state?: JsonValue | undefined;
  self_destruct_type?: JsonValue | undefined;
  sender_business_bot_user_id?: string | undefined;
  sender_id?: TdlibSender | undefined;
  sending_state?: JsonValue | undefined;
  suggested_post_info?: JsonValue | undefined;
  topic_id?: JsonValue | undefined;
  unread_reactions?: JsonValue | undefined;
  via_bot_user_id?: string | undefined;
};

export type TdlibMessages = {
  _: 'messages';
  messages: TdlibMessage[];
  total_count?: number | undefined;
};

export const tdlibMessageSchema = tdlibMessageInputSchema.transform(buildTdlibMessage);
export const tdlibMessagesSchema = tdlibMessagesInputSchema;

export function tdlibMessage(input: unknown): TdlibMessage {
  return tdlibMessageSchema.parse(input);
}

export function tdlibMessages(input: unknown): TdlibMessages {
  return tdlibMessagesSchema.parse(input);
}

export function messageSenderId(message: TdlibMessage): string | undefined {
  return message.sender_id?.user_id ?? message.sender_id?.chat_id;
}

export function messageText(message: TdlibMessage): string | undefined {
  const text = messageTextContent(message);
  return typeof text?.text === 'string' ? text.text : undefined;
}

export function messageTextEntities(message: TdlibMessage): TelegramMessageTextEntity[] {
  const text = messageTextContent(message);
  return text === undefined ? [] : extractFormattedTextLinkEntities(text);
}

export function tdlibMessageContentText(content: TdlibObject): string | undefined {
  const text = tdlibMessageTextContent(content);
  return typeof text?.text === 'string' ? text.text : undefined;
}

export function tdlibMessageContentTextEntities(content: TdlibObject): TelegramMessageTextEntity[] {
  const text = tdlibMessageTextContent(content);
  return text === undefined ? [] : extractFormattedTextLinkEntities(text);
}

export function tdlibMessageContentServiceAction(
  content: TdlibObject
): TelegramMessageServiceAction | undefined {
  if (content._ !== 'messageChatDeleteMember') {
    return undefined;
  }

  const userId = tdlibJsonIdString(content.user_id);
  return userId === undefined
    ? undefined
    : {
        kind: 'chatMemberLeft',
        userId
      };
}

export function extractFormattedTextLinkEntities(value: unknown): TelegramMessageTextEntity[] {
  const formattedText = isRecord(value);
  const text = typeof formattedText?.text === 'string' ? formattedText.text : '';
  const sourceEntities = Array.isArray(formattedText?.entities) ? formattedText.entities : [];
  const entities = sourceEntities
    .map((entity) => telegramTextLinkEntity(entity, text))
    .filter((entity): entity is TelegramMessageTextEntity => entity !== undefined)
    .sort(compareTextEntities);

  const result: TelegramMessageTextEntity[] = [];
  let consumedUntil = 0;
  for (const entity of entities) {
    if (entity.offset < consumedUntil) {
      continue;
    }
    result.push(entity);
    consumedUntil = entity.offset + entity.length;
  }
  return result;
}

function buildTdlibMessage(message: TdlibMessageInput): TdlibMessage {
  return {
    ...message,
    chat_id: String(message.chat_id),
    content: tdlibJsonObject(message.content),
    date: tdlibDate(message.date),
    edit_date: tdlibDate(message.edit_date),
    effect_id: tdlibIdString(message.effect_id),
    fact_check: tdlibJsonValue(message.fact_check),
    forward_info: tdlibJsonValue(message.forward_info),
    guest_bot_caller_id: tdlibJsonValue(message.guest_bot_caller_id),
    id: String(message.id),
    import_info: tdlibJsonValue(message.import_info),
    interaction_info: tdlibJsonValue(message.interaction_info),
    media_album_id: tdlibIdString(message.media_album_id),
    paid_message_star_count: tdlibIdString(message.paid_message_star_count),
    message: tdlibJsonObject(message),
    reply_markup: tdlibJsonValue(message.reply_markup),
    reply_to: tdlibJsonValue(message.reply_to),
    restriction_info: tdlibJsonValue(message.restriction_info),
    scheduling_state: tdlibJsonValue(message.scheduling_state),
    self_destruct_type: tdlibJsonValue(message.self_destruct_type),
    sender_business_bot_user_id: tdlibIdString(message.sender_business_bot_user_id),
    sender_id: message.sender_id === undefined ? undefined : tdlibSender(message.sender_id),
    sending_state: tdlibJsonValue(message.sending_state),
    suggested_post_info: tdlibJsonValue(message.suggested_post_info),
    topic_id: tdlibJsonValue(message.topic_id),
    unread_reactions: tdlibJsonValue(message.unread_reactions),
    via_bot_user_id: tdlibIdString(message.via_bot_user_id)
  };
}

function tdlibSender(value: unknown): TdlibSender {
  const sender = tdlibJsonObject(value) as TdlibSender;
  const userId = tdlibJsonIdString(sender.user_id);
  const chatId = tdlibJsonIdString(sender.chat_id);

  if (userId === undefined) {
    delete sender.user_id;
  } else {
    sender.user_id = userId;
  }

  if (chatId === undefined) {
    delete sender.chat_id;
  } else {
    sender.chat_id = chatId;
  }

  return sender;
}

function tdlibJsonIdString(value: JsonValue | undefined): string | undefined {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : undefined;
}

function messageTextContent(message: TdlibMessage): JsonObject | undefined {
  return tdlibMessageTextContent(message.content);
}

function tdlibMessageTextContent(content: TdlibObject): JsonObject | undefined {
  if (content._ !== 'messageText') {
    return undefined;
  }
  return isJsonObject(content.text) ? content.text : undefined;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function telegramTextLinkEntity(
  value: unknown,
  text: string
): TelegramMessageTextEntity | undefined {
  const entity = isRecord(value);
  const type = isRecord(entity?.type);
  const offset = safeInteger(entity?.offset);
  const length = safeInteger(entity?.length);
  if (
    offset === undefined ||
    length === undefined ||
    length <= 0 ||
    offset < 0 ||
    offset + length > text.length
  ) {
    return undefined;
  }

  if (type?._ === 'textEntityTypeUrl') {
    const url = normalizeHttpUrl(text.slice(offset, offset + length), true);
    return url === null ? undefined : { kind: 'url', length, offset, url };
  }

  if (type?._ === 'textEntityTypeTextUrl') {
    const url = normalizeHttpUrl(type.url, false);
    return url === null ? undefined : { kind: 'textUrl', length, offset, url };
  }

  return undefined;
}

function normalizeHttpUrl(value: unknown, allowMissingProtocol: boolean): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const directUrl = parseHttpUrl(trimmed);
  if (directUrl !== null || !allowMissingProtocol) {
    return directUrl;
  }
  return parseHttpUrl(`https://${trimmed}`);
}

function parseHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function compareTextEntities(
  left: TelegramMessageTextEntity,
  right: TelegramMessageTextEntity
): number {
  if (left.offset !== right.offset) {
    return left.offset - right.offset;
  }
  return right.length - left.length;
}

function safeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function isRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
