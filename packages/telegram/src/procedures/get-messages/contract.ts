import { z } from 'zod';

import { messageSchema } from '../../domain/models/message.js';
import {
  messageOwnerSchema,
  messageReadRequestSchema,
  messageSelectorSchema,
  pageSelectorSchema,
  rangeSelectorSchema,
  type MessageReadRequest,
  type MessageOwner,
  type MessageSelector,
  type PageSelector,
  type RangeSelector
} from '../../domain/models/messageSelection.js';

export {
  messageOwnerSchema,
  messageReadRequestSchema,
  messageSelectorSchema,
  pageSelectorSchema,
  rangeSelectorSchema
};

export const getMessagesInputSchema = messageReadRequestSchema;

export const readyPageOutputSchema = z.object({
  messages: z.array(messageSchema),
  reachedStart: z.boolean(),
  status: z.literal('ready')
});

export const readyRangeOutputSchema = z.object({
  messages: z.array(messageSchema),
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

export type { MessageOwner, MessageSelector, PageSelector, RangeSelector };
export type GetMessagesInput = MessageReadRequest;
export type GetMessagesOutput = z.infer<typeof getMessagesOutputSchema>;
