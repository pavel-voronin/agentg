import { z } from 'zod';

import {
  isoDateTimeStringSchema,
  positiveIntegerSchema,
  readMessageSchema
} from '../../views/schemas.js';

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
    messageId: idSchema
  })
]);

export const pageSelectorSchema = z.object({
  beforeMessageId: idSchema.optional(),
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

export const getMessagesInputSchema = z.object({
  owner: messageOwnerSchema,
  selector: messageSelectorSchema
});

export const readyPageOutputSchema = z.object({
  messages: z.array(readMessageSchema),
  reachedStart: z.boolean(),
  status: z.literal('ready')
});

export const readyRangeOutputSchema = z.object({
  messages: z.array(readMessageSchema),
  status: z.literal('ready')
});

export const pendingOutputSchema = z.object({
  requestId: z.string().trim().min(1),
  status: z.literal('pending')
});

export const getMessagesOutputSchema = z.union([
  readyPageOutputSchema,
  readyRangeOutputSchema,
  pendingOutputSchema
]);

export type MessageOwner = z.infer<typeof messageOwnerSchema>;
export type PageSelector = z.infer<typeof pageSelectorSchema>;
export type RangeSelector = z.infer<typeof rangeSelectorSchema>;
export type MessageSelector = z.infer<typeof messageSelectorSchema>;
export type GetMessagesInput = z.infer<typeof getMessagesInputSchema>;
export type GetMessagesOutput = z.infer<typeof getMessagesOutputSchema>;
