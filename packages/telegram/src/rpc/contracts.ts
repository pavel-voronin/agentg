import { z } from 'zod';

import {
  telegramFileMediaKinds,
  telegramFileRenderKinds,
  telegramFileStatuses
} from '../fileTypes.js';

const nonEmptyStringSchema = z.string().trim().min(1);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const positiveIntegerSchema = z.number().int().positive();
const isoDateTimeStringSchema = z.iso.datetime();

export const telegramHistoryChatSchema = z.object({
  _model: z.literal('telegram.chat'),
  id: z.string(),
  title: z.string(),
  type: z.string()
});

export const telegramHistoryListChatsInputSchema = z.object({
  discover: z.boolean().optional(),
  loadBatchSize: z.number().int().positive().optional()
});

export const telegramHistoryFetchPageInputSchema = z.object({
  chatId: z.string().min(1),
  cursorMessageId: z.number().int().optional(),
  endAt: isoDateTimeStringSchema,
  limit: z.number().int().positive(),
  startAt: isoDateTimeStringSchema
});

export const telegramHistoryIntervalSchema = z.object({
  endAt: isoDateTimeStringSchema,
  startAt: isoDateTimeStringSchema
});

export const telegramHistoryFetchPageResultSchema = z.discriminatedUnion('kind', [
  z.object({
    coveredInterval: telegramHistoryIntervalSchema.optional(),
    fetchedMessages: z.literal(0),
    kind: z.literal('no_messages_before_end'),
    storedMessages: z.literal(0)
  }),
  z.object({
    anchorMessageDate: isoDateTimeStringSchema,
    coveredInterval: telegramHistoryIntervalSchema.optional(),
    fetchedMessages: z.literal(0),
    kind: z.literal('anchor_before_start'),
    storedMessages: z.literal(0)
  }),
  z.object({
    coveredInterval: telegramHistoryIntervalSchema.optional(),
    crossedStart: z.boolean(),
    fetchedMessages: z.number().int().nonnegative(),
    kind: z.literal('page'),
    nextCursorMessageId: z.number().int().optional(),
    oldestFetchedMessageDate: isoDateTimeStringSchema.optional(),
    reachedBeginning: z.boolean(),
    storedMessages: z.number().int().nonnegative()
  })
]);

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
  id: z.string(),
  chat: telegramChatModelRefSchema,
  contentType: z.string(),
  deletedAt: isoDateTimeStringSchema.nullable(),
  editDate: isoDateTimeStringSchema.nullable(),
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

export const telegramGetChatInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

export const telegramGetChatOutputSchema = z.object({
  chat: telegramReadChatSchema.nullable()
});

export const telegramListRecentMessagesInputSchema = z
  .object({
    beforeMessageId: nonEmptyStringSchema.regex(/^[0-9]+$/).optional(),
    chatId: nonEmptyStringSchema.optional(),
    limit: positiveIntegerSchema.optional()
  })
  .default({});

export const telegramListRecentMessagesOutputSchema = z.object({
  messages: z.array(telegramReadMessageSchema)
});

export const telegramSearchMessagesInputSchema = z.object({
  chatId: nonEmptyStringSchema.optional(),
  limit: positiveIntegerSchema.optional(),
  query: nonEmptyStringSchema
});

export const telegramSearchMessagesOutputSchema = z.object({
  messages: z.array(telegramReadMessageSchema)
});

export const telegramChatHistoryFactsChatSchema = z.object({
  _model: z.literal('telegram.chat'),
  id: z.string(),
  isBot: z.boolean(),
  title: z.string(),
  type: z.string(),
  updatedAt: isoDateTimeStringSchema
});

export const telegramGetChatHistoryFactsInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

export const telegramGetChatHistoryFactsOutputSchema = z.object({
  chat: telegramChatHistoryFactsChatSchema.nullable(),
  earliestMessageDate: isoDateTimeStringSchema.nullable(),
  messageCount: nonNegativeIntegerSchema
});

export const telegramCountMessagesInIntervalsInputSchema = z.object({
  chatId: nonEmptyStringSchema,
  intervals: z.array(
    z.object({
      endAt: isoDateTimeStringSchema,
      startAt: isoDateTimeStringSchema
    })
  )
});

export const telegramCountMessagesInIntervalsOutputSchema = z.object({
  counts: z.array(nonNegativeIntegerSchema)
});

export const telegramHistoryCoverageSegmentSchema = telegramHistoryIntervalSchema.extend({
  coveredAt: isoDateTimeStringSchema
});

export const telegramGetHistoryCoverageInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

export const telegramGetHistoryCoverageOutputSchema = z.object({
  coverage: z.array(telegramHistoryCoverageSegmentSchema)
});

export const telegramEnsureHistoryCoverageInputSchema = z.object({
  chatId: nonEmptyStringSchema,
  endAt: isoDateTimeStringSchema,
  limit: positiveIntegerSchema.optional(),
  maxPages: positiveIntegerSchema.optional(),
  requestDelayMs: nonNegativeIntegerSchema.optional(),
  startAt: isoDateTimeStringSchema
});

export const telegramEnsureHistoryCoverageOutputSchema = z.object({
  alreadyCovered: z.boolean(),
  coveredIntervals: z.array(telegramHistoryIntervalSchema),
  fetchedMessages: nonNegativeIntegerSchema,
  pages: nonNegativeIntegerSchema,
  remainingIntervals: z.array(telegramHistoryIntervalSchema),
  reachedBeginning: z.boolean(),
  storedMessages: nonNegativeIntegerSchema
});

export type TelegramHistoryChat = z.infer<typeof telegramHistoryChatSchema>;
export type TelegramHistoryListChatsRequest = z.infer<typeof telegramHistoryListChatsInputSchema>;
export type TelegramHistoryFetchPageRequest = z.infer<typeof telegramHistoryFetchPageInputSchema>;
export type TelegramHistoryFetchPageResult = z.infer<typeof telegramHistoryFetchPageResultSchema>;
export type TelegramHistoryInterval = z.infer<typeof telegramHistoryIntervalSchema>;
export type TelegramReadChat = z.infer<typeof telegramReadChatSchema>;
export type TelegramFileRef = z.infer<typeof telegramFileRefSchema>;
export type TelegramMessageTextEntity = z.infer<typeof telegramMessageTextEntitySchema>;
export type TelegramMessageServiceAction = z.infer<typeof telegramMessageServiceActionSchema>;
export type TelegramReadMessage = z.infer<typeof telegramReadMessageSchema>;
export type TelegramGetChatInput = z.infer<typeof telegramGetChatInputSchema>;
export type TelegramGetChatOutput = z.infer<typeof telegramGetChatOutputSchema>;
export type TelegramListRecentMessagesInput = z.infer<typeof telegramListRecentMessagesInputSchema>;
export type TelegramListRecentMessagesOutput = z.infer<
  typeof telegramListRecentMessagesOutputSchema
>;
export type TelegramSearchMessagesInput = z.infer<typeof telegramSearchMessagesInputSchema>;
export type TelegramSearchMessagesOutput = z.infer<typeof telegramSearchMessagesOutputSchema>;
export type TelegramChatHistoryFactsChat = z.infer<typeof telegramChatHistoryFactsChatSchema>;
export type TelegramGetChatHistoryFactsInput = z.infer<
  typeof telegramGetChatHistoryFactsInputSchema
>;
export type TelegramGetChatHistoryFactsOutput = z.infer<
  typeof telegramGetChatHistoryFactsOutputSchema
>;
export type TelegramCountMessagesInIntervalsInput = z.infer<
  typeof telegramCountMessagesInIntervalsInputSchema
>;
export type TelegramCountMessagesInIntervalsOutput = z.infer<
  typeof telegramCountMessagesInIntervalsOutputSchema
>;
export type TelegramHistoryCoverageSegment = z.infer<typeof telegramHistoryCoverageSegmentSchema>;
export type TelegramGetHistoryCoverageInput = z.infer<typeof telegramGetHistoryCoverageInputSchema>;
export type TelegramGetHistoryCoverageOutput = z.infer<
  typeof telegramGetHistoryCoverageOutputSchema
>;
export type TelegramEnsureHistoryCoverageInput = z.infer<
  typeof telegramEnsureHistoryCoverageInputSchema
>;
export type TelegramEnsureHistoryCoverageOutput = z.infer<
  typeof telegramEnsureHistoryCoverageOutputSchema
>;
