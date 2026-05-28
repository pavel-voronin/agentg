import { z } from 'zod';

import {
  telegramFileMediaKinds,
  telegramFileRenderKinds,
  telegramFileStatuses
} from '../files/types.js';

export const nonEmptyStringSchema = z.string().trim().min(1);
export const nonNegativeIntegerSchema = z.number().int().nonnegative();
export const positiveIntegerSchema = z.number().int().positive();
export const isoDateTimeStringSchema = z.iso.datetime();

export const telegramHistoryIntervalSchema = z.object({
  endAt: isoDateTimeStringSchema,
  startAt: isoDateTimeStringSchema
});

export const telegramChatModelRefSchema = z.object({
  _model: z.literal('telegram.chat'),
  id: z.string()
});

export const telegramDefaultBackgroundModelRefSchema = z.object({
  _model: z.literal('telegram.defaultBackground'),
  id: z.string()
});

export const telegramEmojiChatThemesModelRefSchema = z.object({
  _model: z.literal('telegram.emojiChatThemes'),
  id: z.string()
});

export const telegramActiveNotificationModelRefSchema = z.object({
  _model: z.literal('telegram.activeNotification'),
  id: z.string()
});

export const telegramMessageModelRefSchema = z.object({
  _model: z.literal('telegram.message'),
  id: z.string()
});

export const telegramQuickReplyMessageModelRefSchema = z.object({
  _model: z.literal('telegram.quickReplyMessage'),
  id: z.string()
});

export const telegramStickerSetModelRefSchema = z.object({
  _model: z.literal('telegram.stickerSet'),
  id: z.string()
});

export const telegramStoryModelRefSchema = z.object({
  _model: z.literal('telegram.story'),
  id: z.string()
});

export const telegramUserModelRefSchema = z.object({
  _model: z.literal('telegram.user'),
  id: z.string()
});

export const telegramFileOwnerModelRefSchema = z.discriminatedUnion('_model', [
  telegramActiveNotificationModelRefSchema,
  telegramChatModelRefSchema,
  telegramDefaultBackgroundModelRefSchema,
  telegramEmojiChatThemesModelRefSchema,
  telegramMessageModelRefSchema,
  telegramQuickReplyMessageModelRefSchema,
  telegramStickerSetModelRefSchema,
  telegramStoryModelRefSchema,
  telegramUserModelRefSchema
]);

export const telegramFileRefSchema = z.object({
  _model: z.literal('telegram.file'),
  byteSize: nonNegativeIntegerSchema.nullable(),
  canRequest: z.boolean(),
  downloadedByteSize: nonNegativeIntegerSchema.nullable(),
  downloadError: z.string().nullable(),
  durationSeconds: nonNegativeIntegerSchema.nullable(),
  fileName: z.string().nullable(),
  height: nonNegativeIntegerSchema.nullable(),
  id: z.string(),
  mediaKind: z.enum(telegramFileMediaKinds),
  mimeType: z.string().nullable(),
  owner: telegramFileOwnerModelRefSchema,
  renderKind: z.enum(telegramFileRenderKinds),
  slotKey: z.string(),
  status: z.enum(telegramFileStatuses),
  updatedAt: isoDateTimeStringSchema,
  url: z.string().nullable(),
  width: nonNegativeIntegerSchema.nullable()
});

export const telegramReadChatSchema = z.object({
  _model: z.literal('telegram.chat'),
  avatar: z.object({
    big: telegramFileRefSchema.nullable(),
    small: telegramFileRefSchema.nullable()
  }),
  id: z.string(),
  title: z.string(),
  type: z.string(),
  updatedAt: isoDateTimeStringSchema
});

export const telegramMessageTextEntitySchema = z.object({
  kind: z.union([z.literal('url'), z.literal('textUrl')]),
  length: positiveIntegerSchema,
  offset: nonNegativeIntegerSchema,
  url: z.string()
});

export const telegramMessageServiceActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('chatMemberLeft'),
    user: telegramUserModelRefSchema,
    userDisplayName: z.string()
  })
]);

export const telegramReadMessageSchema = z.object({
  _model: z.literal('telegram.message'),
  chat: telegramChatModelRefSchema,
  contentType: z.string(),
  deletedAt: isoDateTimeStringSchema.nullable(),
  editDate: isoDateTimeStringSchema.nullable(),
  id: z.string(),
  isDeleted: z.boolean(),
  isOutgoing: z.boolean(),
  media: z.object({
    files: z.array(telegramFileRefSchema)
  }),
  messageDate: isoDateTimeStringSchema.nullable(),
  replyTo: z
    .object({
      chat: telegramChatModelRefSchema,
      message: z.object({
        _model: z.literal('telegram.message'),
        id: z.string()
      }),
      telegramMessageId: z.string()
    })
    .nullable(),
  sender: z.union([telegramChatModelRefSchema, telegramUserModelRefSchema]).nullable(),
  senderDisplayName: z.string().nullable(),
  senderType: z.string().nullable(),
  serviceAction: telegramMessageServiceActionSchema.nullable(),
  telegramMessageId: z.string(),
  text: z.string().nullable(),
  textEntities: z.array(telegramMessageTextEntitySchema)
});

export const telegramHistoryCoverageSegmentSchema = telegramHistoryIntervalSchema.extend({
  coveredAt: isoDateTimeStringSchema
});

export type TelegramHistoryInterval = z.infer<typeof telegramHistoryIntervalSchema>;
export type TelegramReadChat = z.infer<typeof telegramReadChatSchema>;
export type TelegramFileRef = z.infer<typeof telegramFileRefSchema>;
export type TelegramMessageTextEntity = z.infer<typeof telegramMessageTextEntitySchema>;
export type TelegramMessageServiceAction = z.infer<typeof telegramMessageServiceActionSchema>;
export type TelegramReadMessage = z.infer<typeof telegramReadMessageSchema>;
export type TelegramHistoryCoverageSegment = z.infer<typeof telegramHistoryCoverageSegmentSchema>;
