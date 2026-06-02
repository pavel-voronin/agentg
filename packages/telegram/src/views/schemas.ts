import { z } from 'zod';

import { fileMediaKinds, fileRenderKinds, fileStatuses } from '../files/types.js';

export const nonEmptyStringSchema = z.string().trim().min(1);
export const nonNegativeIntegerSchema = z.number().int().nonnegative();
export const positiveIntegerSchema = z.number().int().positive();
export const isoDateTimeStringSchema = z.iso.datetime();

export const historyIntervalSchema = z.object({
  endAt: isoDateTimeStringSchema,
  startAt: isoDateTimeStringSchema
});

export const chatModelRefSchema = z.object({
  _model: z.literal('telegram.chat'),
  id: z.string()
});

export const defaultBackgroundModelRefSchema = z.object({
  _model: z.literal('telegram.defaultBackground'),
  id: z.string()
});

export const emojiChatThemesModelRefSchema = z.object({
  _model: z.literal('telegram.emojiChatThemes'),
  id: z.string()
});

export const activeNotificationModelRefSchema = z.object({
  _model: z.literal('telegram.activeNotification'),
  id: z.string()
});

export const messageModelRefSchema = z.object({
  _model: z.literal('telegram.message'),
  id: z.string()
});

export const quickReplyMessageModelRefSchema = z.object({
  _model: z.literal('telegram.quickReplyMessage'),
  id: z.string()
});

export const stickerSetModelRefSchema = z.object({
  _model: z.literal('telegram.stickerSet'),
  id: z.string()
});

export const storyModelRefSchema = z.object({
  _model: z.literal('telegram.story'),
  id: z.string()
});

export const userModelRefSchema = z.object({
  _model: z.literal('telegram.user'),
  id: z.string()
});

export const fileOwnerModelRefSchema = z.discriminatedUnion('_model', [
  activeNotificationModelRefSchema,
  chatModelRefSchema,
  defaultBackgroundModelRefSchema,
  emojiChatThemesModelRefSchema,
  messageModelRefSchema,
  quickReplyMessageModelRefSchema,
  stickerSetModelRefSchema,
  storyModelRefSchema,
  userModelRefSchema
]);

export const fileRefSchema = z.object({
  _model: z.literal('telegram.file'),
  byteSize: nonNegativeIntegerSchema.nullable(),
  canRequest: z.boolean(),
  downloadedByteSize: nonNegativeIntegerSchema.nullable(),
  downloadError: z.string().nullable(),
  durationSeconds: nonNegativeIntegerSchema.nullable(),
  fileName: z.string().nullable(),
  height: nonNegativeIntegerSchema.nullable(),
  id: z.string(),
  mediaKind: z.enum(fileMediaKinds),
  mimeType: z.string().nullable(),
  owner: fileOwnerModelRefSchema,
  renderKind: z.enum(fileRenderKinds),
  slotKey: z.string(),
  status: z.enum(fileStatuses),
  updatedAt: isoDateTimeStringSchema,
  url: z.string().nullable(),
  width: nonNegativeIntegerSchema.nullable()
});

export const readChatSchema = z.object({
  _model: z.literal('telegram.chat'),
  avatar: z.object({
    big: fileRefSchema.nullable(),
    small: fileRefSchema.nullable()
  }),
  id: z.string(),
  title: z.string(),
  type: z.string(),
  updatedAt: isoDateTimeStringSchema
});

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

export const readMessageSchema = z.object({
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
      message: z.object({
        _model: z.literal('telegram.message'),
        id: z.string()
      }),
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

export const historyCoverageSegmentSchema = historyIntervalSchema.extend({
  coveredAt: isoDateTimeStringSchema
});

export type HistoryInterval = z.infer<typeof historyIntervalSchema>;
export type ReadChat = z.infer<typeof readChatSchema>;
export type FileRef = z.infer<typeof fileRefSchema>;
export type MessageTextEntity = z.infer<typeof messageTextEntitySchema>;
export type MessageReaction = z.infer<typeof messageReactionSchema>;
export type MessageServiceAction = z.infer<typeof messageServiceActionSchema>;
export type ReadMessage = z.infer<typeof readMessageSchema>;
export type HistoryCoverageSegment = z.infer<typeof historyCoverageSegmentSchema>;
