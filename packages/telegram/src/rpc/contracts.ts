import { z } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const positiveIntegerSchema = z.number().int().positive();

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
  endAt: z.string().min(1),
  limit: z.number().int().positive(),
  startAt: z.string().min(1)
});

export const telegramHistoryFetchPageResultSchema = z.discriminatedUnion('kind', [
  z.object({
    fetchedMessages: z.literal(0),
    kind: z.literal('no_messages_before_end'),
    storedMessages: z.literal(0)
  }),
  z.object({
    anchorMessageDate: z.string(),
    fetchedMessages: z.literal(0),
    kind: z.literal('anchor_before_start'),
    storedMessages: z.literal(0)
  }),
  z.object({
    crossedStart: z.boolean(),
    fetchedMessages: z.number().int().nonnegative(),
    kind: z.literal('page'),
    nextCursorMessageId: z.number().int().optional(),
    oldestFetchedMessageDate: z.string().optional(),
    reachedBeginning: z.boolean(),
    storedMessages: z.number().int().nonnegative()
  })
]);

export const telegramReadChatSchema = z.object({
  _model: z.literal('telegram.chat'),
  id: z.string(),
  title: z.string(),
  type: z.string(),
  updatedAt: z.string()
});

export const telegramChatModelRefSchema = z.object({
  _model: z.literal('telegram.chat'),
  id: z.string()
});

export const telegramUserModelRefSchema = z.object({
  _model: z.literal('telegram.user'),
  id: z.string()
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
  deletedAt: z.string().nullable(),
  editDate: z.string().nullable(),
  isDeleted: z.boolean(),
  isOutgoing: z.boolean(),
  messageDate: z.string().nullable(),
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
  textEntities: z.array(telegramMessageTextEntitySchema),
  updatedAt: z.string()
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

export const telegramChatPlacementSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('archive'),
    order: z.string()
  }),
  z.object({
    kind: z.literal('main'),
    order: z.string()
  }),
  z.object({
    folderId: nonNegativeIntegerSchema,
    kind: z.literal('folder'),
    order: z.string()
  })
]);

export const telegramChatDirectoryEntrySchema = telegramReadChatSchema.extend({
  isBot: z.boolean(),
  isSelf: z.boolean(),
  lastMessageDate: nonNegativeIntegerSchema,
  placements: z.array(telegramChatPlacementSchema)
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
  earliestMessageDate: z.string().nullable(),
  messageCount: nonNegativeIntegerSchema
});

export const telegramCountMessagesInIntervalsInputSchema = z.object({
  chatId: nonEmptyStringSchema,
  intervals: z.array(
    z.object({
      endAt: nonEmptyStringSchema,
      startAt: nonEmptyStringSchema
    })
  )
});

export const telegramCountMessagesInIntervalsOutputSchema = z.object({
  counts: z.array(nonNegativeIntegerSchema)
});

export type TelegramHistoryChat = z.infer<typeof telegramHistoryChatSchema>;
export type TelegramHistoryListChatsRequest = z.infer<typeof telegramHistoryListChatsInputSchema>;
export type TelegramHistoryFetchPageRequest = z.infer<typeof telegramHistoryFetchPageInputSchema>;
export type TelegramHistoryFetchPageResult = z.infer<typeof telegramHistoryFetchPageResultSchema>;
export type TelegramReadChat = z.infer<typeof telegramReadChatSchema>;
export type TelegramMessageTextEntity = z.infer<typeof telegramMessageTextEntitySchema>;
export type TelegramMessageServiceAction = z.infer<typeof telegramMessageServiceActionSchema>;
export type TelegramReadMessage = z.infer<typeof telegramReadMessageSchema>;
export type TelegramGetChatInput = z.infer<typeof telegramGetChatInputSchema>;
export type TelegramGetMessageInput = z.infer<typeof telegramGetMessageInputSchema>;
export type TelegramListRecentMessagesInput = z.infer<typeof telegramListRecentMessagesInputSchema>;
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
