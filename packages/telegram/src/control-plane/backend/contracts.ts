import { z } from 'zod';

import {
  telegramFileOwnerModelRefSchema,
  telegramFileRefSchema,
  telegramReadChatSchema,
  telegramReadMessageSchema
} from '../../rpc/contracts.js';

const nonEmptyStringSchema = z.string().trim().min(1);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const positiveIntegerSchema = z.number().int().positive();
const isoDateTimeStringSchema = z.iso.datetime();

export const chatPlacementSchema = z.discriminatedUnion('kind', [
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

export const chatLastMessageSchema = z.object({
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

export const chatDirectoryEntrySchema = telegramReadChatSchema.extend({
  isBot: z.boolean(),
  isPremium: z.boolean(),
  isSelf: z.boolean(),
  isUnread: z.boolean(),
  lastMessage: chatLastMessageSchema.nullable(),
  lastMessageDate: isoDateTimeStringSchema.nullable(),
  notificationsEnabled: z.boolean().nullable(),
  notificationsPlaceholder: z.boolean(),
  placements: z.array(chatPlacementSchema),
  unreadCount: nonNegativeIntegerSchema,
  unreadCountPlaceholder: z.boolean()
});

export const chatFolderSchema = z.object({
  _model: z.literal('telegram.chatFolder'),
  folderId: nonNegativeIntegerSchema,
  iconName: z.string().nullable(),
  id: z.string(),
  position: nonNegativeIntegerSchema,
  title: z.string()
});

export const chatTypeCountSchema = z.object({
  count: nonNegativeIntegerSchema,
  type: z.string()
});

export const chatDirectoryInputSchema = z
  .object({
    query: nonEmptyStringSchema.optional(),
    type: nonEmptyStringSchema.optional()
  })
  .default({});

export const chatDirectoryOutputSchema = z.object({
  chats: z.array(chatDirectoryEntrySchema),
  folders: z.array(chatFolderSchema),
  navigationChats: z.array(chatDirectoryEntrySchema),
  types: z.array(chatTypeCountSchema)
});

export const messagesPageInputSchema = z.object({
  beforeMessageId: nonEmptyStringSchema.regex(/^[0-9]+$/).optional(),
  chatId: nonEmptyStringSchema,
  limit: positiveIntegerSchema.optional()
});

export const messagesPageOutputSchema = z.object({
  messages: z.array(telegramReadMessageSchema),
  reachedStart: z.boolean()
});

export const messageLookupInputSchema = z.object({
  chatId: nonEmptyStringSchema,
  messageId: nonEmptyStringSchema
});

export const messageLookupOutputSchema = z.object({
  message: telegramReadMessageSchema.nullable()
});

export const fileQueueStatsSchema = z.object({
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

export const fileQueueStatsInputSchema = z.object({}).default({});

export const fileQueueStatsOutputSchema = z.object({
  stats: fileQueueStatsSchema
});

export const fileRequestInputSchema = z.object({
  owner: telegramFileOwnerModelRefSchema,
  slotKey: nonEmptyStringSchema
});

export const fileRequestOutputSchema = z.object({
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

export type ChatPlacement = z.infer<typeof chatPlacementSchema>;
export type ChatDirectoryEntry = z.infer<typeof chatDirectoryEntrySchema>;
export type ChatFolder = z.infer<typeof chatFolderSchema>;
export type ChatTypeCount = z.infer<typeof chatTypeCountSchema>;
export type ChatDirectoryInput = z.infer<typeof chatDirectoryInputSchema>;
export type ChatDirectoryOutput = z.infer<typeof chatDirectoryOutputSchema>;
export type MessagesPageInput = z.infer<typeof messagesPageInputSchema>;
export type MessagesPageOutput = z.infer<typeof messagesPageOutputSchema>;
export type MessageLookupInput = z.infer<typeof messageLookupInputSchema>;
export type MessageLookupOutput = z.infer<typeof messageLookupOutputSchema>;
export type FileQueueStatsOutput = z.infer<typeof fileQueueStatsOutputSchema>;
export type FileRequestInput = z.infer<typeof fileRequestInputSchema>;
export type FileRequestOutput = z.infer<typeof fileRequestOutputSchema>;
