import { z } from 'zod';

import { chatSchema } from './chat.js';
import { chatPlacementSchema } from './chatPlacement.js';
import {
  isoDateTimeStringSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema
} from './scalars.js';

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

export const chatDirectoryEntrySchema = chatSchema.extend({
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

export const chatDirectoryTypeSchema = z.enum(['private', 'secret', 'group', 'channel']);

export const chatDirectoryInputSchema = z
  .object({
    query: nonEmptyStringSchema.optional(),
    type: chatDirectoryTypeSchema.optional()
  })
  .default({});

export const chatDirectorySchema = z.object({
  chats: z.array(chatDirectoryEntrySchema),
  folders: z.array(chatFolderSchema),
  navigationChats: z.array(chatDirectoryEntrySchema),
  types: z.array(chatTypeCountSchema)
});

export type ChatDirectory = z.infer<typeof chatDirectorySchema>;
export type ChatDirectoryEntry = z.infer<typeof chatDirectoryEntrySchema>;
export type ChatDirectoryInput = z.infer<typeof chatDirectoryInputSchema>;
export type ChatDirectoryType = z.infer<typeof chatDirectoryTypeSchema>;
export type ChatFolder = z.infer<typeof chatFolderSchema>;
export type ChatTypeCount = z.infer<typeof chatTypeCountSchema>;
