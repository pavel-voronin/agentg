import { z } from 'zod';

import { isoDateTimeStringSchema, positiveIntegerSchema } from './scalars.js';

const idSchema = z
  .string()
  .trim()
  .regex(/^-?[0-9]+$/)
  .refine((value) => Number.isSafeInteger(Number(value)))
  .transform((value) => String(Number(value)));

const int32IdSchema = idSchema.refine((value) => {
  const parsed = Number(value);
  return parsed >= -2_147_483_648 && parsed <= 2_147_483_647;
});

const messageIdSchema = idSchema.refine((value) => Number(value) > 0);

export const messageOwnerSchema = z.discriminatedUnion('kind', [
  z.object({
    chatId: idSchema,
    kind: z.literal('chat')
  }),
  z.object({
    chatId: idSchema,
    kind: z.literal('forumTopic'),
    topicId: int32IdSchema
  }),
  z.object({
    chatId: idSchema,
    kind: z.literal('directMessagesTopic'),
    topicId: idSchema
  }),
  z.object({
    kind: z.literal('savedMessagesTopic'),
    topicId: idSchema
  }),
  z.object({
    chatId: idSchema,
    kind: z.literal('messageThread'),
    messageId: messageIdSchema
  })
]);

export const pageSelectorSchema = z.object({
  beforeMessageId: messageIdSchema.optional(),
  count: positiveIntegerSchema,
  kind: z.literal('page')
});

export const rangeSelectorSchema = z.object({
  endAt: isoDateTimeStringSchema,
  kind: z.literal('range'),
  startAt: isoDateTimeStringSchema
});

export const messageSelectorSchema = z.discriminatedUnion('kind', [
  pageSelectorSchema,
  rangeSelectorSchema
]);

export const messageReadRequestSchema = z.object({
  owner: messageOwnerSchema,
  selector: messageSelectorSchema
});

export type MessageOwner = z.infer<typeof messageOwnerSchema>;
export type PageSelector = z.infer<typeof pageSelectorSchema>;
export type RangeSelector = z.infer<typeof rangeSelectorSchema>;
export type MessageSelector = z.infer<typeof messageSelectorSchema>;
export type MessageReadRequest = z.infer<typeof messageReadRequestSchema>;

export type OwnerKind =
  | 'chat'
  | 'direct_messages_topic'
  | 'forum_topic'
  | 'message_thread'
  | 'saved_messages_topic';

export const ownerKindValues = [
  'chat',
  'direct_messages_topic',
  'forum_topic',
  'message_thread',
  'saved_messages_topic'
] satisfies OwnerKind[];

export type NormalizedMessageOwner = {
  chatId?: string | undefined;
  key: string;
  kind: OwnerKind;
  owner: MessageOwner;
};

export function normalizeMessageOwner(owner: MessageOwner): NormalizedMessageOwner {
  switch (owner.kind) {
    case 'chat':
      return {
        chatId: owner.chatId,
        key: `chat:${owner.chatId}`,
        kind: 'chat',
        owner
      };
    case 'forumTopic':
      return {
        chatId: owner.chatId,
        key: `forum-topic:${owner.chatId}:${owner.topicId}`,
        kind: 'forum_topic',
        owner
      };
    case 'directMessagesTopic':
      return {
        chatId: owner.chatId,
        key: `direct-messages-topic:${owner.chatId}:${owner.topicId}`,
        kind: 'direct_messages_topic',
        owner
      };
    case 'savedMessagesTopic':
      return {
        key: `saved-messages-topic:${owner.topicId}`,
        kind: 'saved_messages_topic',
        owner
      };
    case 'messageThread':
      return {
        chatId: owner.chatId,
        key: `message-thread:${owner.chatId}:${owner.messageId}`,
        kind: 'message_thread',
        owner
      };
  }
}

export function parseTelegramInt53(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} must be a Telegram int53 decimal string: ${value}`);
  }
  return parsed;
}

export function parseTelegramInt32(value: string, label: string): number {
  const parsed = parseTelegramInt53(value, label);
  if (parsed < -2_147_483_648 || parsed > 2_147_483_647) {
    throw new Error(`${label} must be a Telegram int32 decimal string: ${value}`);
  }
  return parsed;
}
