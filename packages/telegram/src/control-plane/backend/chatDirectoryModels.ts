import { z } from 'zod';

import {
  isoDateTimeStringSchema,
  nonNegativeIntegerSchema,
  telegramReadChatSchema
} from '../../read-model/api.js';

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

export type ChatPlacement = z.infer<typeof chatPlacementSchema>;
export type ChatDirectoryEntry = z.infer<typeof chatDirectoryEntrySchema>;
export type ChatFolder = z.infer<typeof chatFolderSchema>;
export type ChatTypeCount = z.infer<typeof chatTypeCountSchema>;
