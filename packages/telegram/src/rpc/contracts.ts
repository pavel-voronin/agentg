import { z } from 'zod';

import {
  telegramFileMediaKinds,
  telegramFileRenderKinds,
  telegramFileStatuses
} from '../telegram-file-types.js';

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

export const telegramMessageModelRefSchema = z.object({
  _model: z.literal('telegram.message'),
  id: z.string()
});

export const telegramUserModelRefSchema = z.object({
  _model: z.literal('telegram.user'),
  id: z.string()
});

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
  owner: z.union([telegramChatModelRefSchema, telegramMessageModelRefSchema]),
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

export const telegramGetMessageInputSchema = z.object({
  chatId: nonEmptyStringSchema,
  messageId: nonEmptyStringSchema
});

export const telegramGetMessageOutputSchema = z.object({
  message: telegramReadMessageSchema.nullable()
});

export const telegramRequestFileInputSchema = z.object({
  owner: z.union([telegramChatModelRefSchema, telegramMessageModelRefSchema]),
  slotKey: nonEmptyStringSchema
});

export const telegramRequestFileOutputSchema = z.object({
  decision: z.discriminatedUnion('action', [
    z.object({
      action: z.literal('record'),
      reason: z.string()
    }),
    z.object({
      action: z.literal('enqueue'),
      reason: z.string()
    }),
    z.object({
      action: z.literal('deny'),
      reason: z.string()
    })
  ]),
  file: telegramFileRefSchema.nullable()
});

export const telegramFileQueueStatsSchema = z.object({
  downloadingCount: nonNegativeIntegerSchema,
  failedCount: nonNegativeIntegerSchema,
  knownCount: nonNegativeIntegerSchema,
  knownDownloadedBytes: nonNegativeIntegerSchema,
  knownRemainingBytes: nonNegativeIntegerSchema,
  knownTotalBytes: nonNegativeIntegerSchema,
  queuedCount: nonNegativeIntegerSchema,
  readyCount: nonNegativeIntegerSchema,
  remainingCount: nonNegativeIntegerSchema,
  totalCount: nonNegativeIntegerSchema,
  unknownRemainingCount: nonNegativeIntegerSchema
});

export const telegramGetFileQueueStatsInputSchema = z.object({}).default({});

export const telegramGetFileQueueStatsOutputSchema = z.object({
  stats: telegramFileQueueStatsSchema
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

export const telegramFetchMessagesPageInputSchema = z.object({
  beforeMessageId: nonEmptyStringSchema.regex(/^[0-9]+$/).optional(),
  chatId: nonEmptyStringSchema,
  limit: positiveIntegerSchema.optional()
});

export const telegramFetchMessagesPageOutputSchema = z.object({
  messages: z.array(telegramReadMessageSchema),
  reachedStart: z.boolean()
});

export const telegramSearchMessagesInputSchema = z.object({
  chatId: nonEmptyStringSchema.optional(),
  limit: positiveIntegerSchema.optional(),
  query: nonEmptyStringSchema
});

export const telegramSearchMessagesOutputSchema = z.object({
  messages: z.array(telegramReadMessageSchema)
});

export const telegramChatPlacementSchema = z.discriminatedUnion('kind', [
  z.object({
    isPinned: z.boolean(),
    kind: z.literal('archive'),
    order: z.string()
  }),
  z.object({
    isPinned: z.boolean(),
    kind: z.literal('main'),
    order: z.string()
  }),
  z.object({
    folderId: nonNegativeIntegerSchema,
    isPinned: z.boolean(),
    kind: z.literal('folder'),
    order: z.string()
  })
]);

export const telegramChatLastMessageSchema = z.object({
  authorName: z.string().nullable(),
  authorPlaceholder: z.boolean(),
  date: isoDateTimeStringSchema.nullable(),
  datePlaceholder: z.boolean(),
  isForwarded: z.boolean(),
  isOutgoing: z.boolean(),
  isRead: z.boolean().nullable(),
  readPlaceholder: z.boolean(),
  text: z.string(),
  textPlaceholder: z.boolean()
});

export const telegramChatDirectoryEntrySchema = telegramReadChatSchema.extend({
  isBot: z.boolean(),
  isPremium: z.boolean(),
  isSelf: z.boolean(),
  isUnread: z.boolean(),
  lastMessage: telegramChatLastMessageSchema.nullable(),
  lastMessageDate: isoDateTimeStringSchema.nullable(),
  notificationsEnabled: z.boolean().nullable(),
  notificationsPlaceholder: z.boolean(),
  placements: z.array(telegramChatPlacementSchema),
  unreadCount: nonNegativeIntegerSchema,
  unreadCountPlaceholder: z.boolean()
});

export const telegramChatFolderSchema = z.object({
  _model: z.literal('telegram.chatFolder'),
  folderId: nonNegativeIntegerSchema,
  iconName: z.string().nullable(),
  id: z.string(),
  position: nonNegativeIntegerSchema,
  title: z.string()
});

export const telegramChatTypeCountSchema = z.object({
  count: nonNegativeIntegerSchema,
  type: z.string()
});

export const telegramListChatDirectoryInputSchema = z
  .object({
    query: nonEmptyStringSchema.optional(),
    type: nonEmptyStringSchema.optional()
  })
  .default({});

export const telegramListChatDirectoryOutputSchema = z.object({
  chats: z.array(telegramChatDirectoryEntrySchema),
  folders: z.array(telegramChatFolderSchema),
  navigationChats: z.array(telegramChatDirectoryEntrySchema),
  types: z.array(telegramChatTypeCountSchema)
});

export const telegramGetChatHistoryFactsInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

export const telegramGetChatHistoryFactsOutputSchema = z.object({
  chat: telegramChatDirectoryEntrySchema.nullable(),
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
export type TelegramGetMessageInput = z.infer<typeof telegramGetMessageInputSchema>;
export type TelegramRequestFileInput = z.infer<typeof telegramRequestFileInputSchema>;
export type TelegramRequestFileOutput = z.infer<typeof telegramRequestFileOutputSchema>;
export type TelegramListRecentMessagesInput = z.infer<typeof telegramListRecentMessagesInputSchema>;
export type TelegramFetchMessagesPageInput = z.infer<typeof telegramFetchMessagesPageInputSchema>;
export type TelegramFetchMessagesPageOutput = z.infer<typeof telegramFetchMessagesPageOutputSchema>;
export type TelegramSearchMessagesInput = z.infer<typeof telegramSearchMessagesInputSchema>;
export type TelegramChatPlacement = z.infer<typeof telegramChatPlacementSchema>;
export type TelegramChatDirectoryEntry = z.infer<typeof telegramChatDirectoryEntrySchema>;
export type TelegramChatFolder = z.infer<typeof telegramChatFolderSchema>;
export type TelegramChatTypeCount = z.infer<typeof telegramChatTypeCountSchema>;
export type TelegramListChatDirectoryInput = z.infer<typeof telegramListChatDirectoryInputSchema>;
export type TelegramListChatDirectoryOutput = z.infer<typeof telegramListChatDirectoryOutputSchema>;
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
