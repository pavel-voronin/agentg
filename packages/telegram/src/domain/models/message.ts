import { z } from 'zod';

import {
  chatModelRefSchema,
  fileRefSchema,
  messageModelRefSchema,
  userModelRefSchema,
  type FileRef
} from './fileRef.js';
import {
  isoDateTimeStringSchema,
  nonNegativeIntegerSchema,
  positiveIntegerSchema
} from './scalars.js';

export const messageTextEntitySchema = z.object({
  kind: z.union([z.literal('url'), z.literal('textUrl')]),
  length: positiveIntegerSchema,
  offset: nonNegativeIntegerSchema,
  url: z.string()
});

export const messageReactionSchema = z.object({
  isChosen: z.boolean(),
  reactionType: z.string(),
  recentSenderIds: z.array(z.unknown()),
  totalCount: nonNegativeIntegerSchema,
  usedSenderId: z.unknown().nullable()
});

export const messageServiceActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('chatMemberLeft'),
    user: userModelRefSchema,
    userDisplayName: z.string()
  })
]);

export const messageSchema = z.object({
  _model: z.literal('telegram.message'),
  chat: chatModelRefSchema,
  contentType: z.string(),
  deletedAt: isoDateTimeStringSchema.nullable(),
  editDate: isoDateTimeStringSchema.nullable(),
  id: z.string(),
  isDeleted: z.boolean(),
  isOutgoing: z.boolean(),
  media: z.object({
    files: z.array(fileRefSchema)
  }),
  messageDate: isoDateTimeStringSchema.nullable(),
  reactions: z.array(messageReactionSchema),
  replyTo: z
    .object({
      chat: chatModelRefSchema,
      message: messageModelRefSchema,
      telegramMessageId: z.string()
    })
    .nullable(),
  sender: z.union([chatModelRefSchema, userModelRefSchema]).nullable(),
  senderDisplayName: z.string().nullable(),
  senderType: z.string().nullable(),
  serviceAction: messageServiceActionSchema.nullable(),
  telegramMessageId: z.string(),
  text: z.string().nullable(),
  textEntities: z.array(messageTextEntitySchema)
});

export type MessageTextEntity = z.infer<typeof messageTextEntitySchema>;
export type MessageReaction = z.infer<typeof messageReactionSchema>;
export type MessageServiceAction = z.infer<typeof messageServiceActionSchema>;
export type Message = z.infer<typeof messageSchema>;
export type { FileRef };
