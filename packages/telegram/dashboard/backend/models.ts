import { z } from 'zod';

import {
  fileOwnerModelRefSchema,
  fileRefSchema,
  isoDateTimeStringSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema,
  positiveIntegerSchema,
  readChatSchema,
  readMessageSchema
} from '../../src/views/schemas.js';

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

export const chatDirectoryEntrySchema = readChatSchema.extend({
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

export const messageLookupInputSchema = z.object({
  chatId: nonEmptyStringSchema,
  messageId: nonEmptyStringSchema
});

export const messageLookupOutputSchema = z.object({
  message: readMessageSchema.nullable()
});

export const messagesPageInputSchema = z.object({
  beforeMessageId: nonEmptyStringSchema.regex(/^[0-9]+$/).optional(),
  chatId: nonEmptyStringSchema,
  limit: positiveIntegerSchema.optional()
});

export const messagesPageOutputSchema = z.object({
  messages: z.array(readMessageSchema),
  reachedStart: z.boolean()
});

export const fileRequestInputSchema = z.object({
  owner: fileOwnerModelRefSchema,
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
  file: fileRefSchema.nullable()
});

export type ChatDirectoryEntry = z.infer<typeof chatDirectoryEntrySchema>;
export type ChatFolder = z.infer<typeof chatFolderSchema>;
export type ChatTypeCount = z.infer<typeof chatTypeCountSchema>;
