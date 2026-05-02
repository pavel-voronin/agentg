import type { TelegramDatabase as AppDatabase } from '../database.js';
import { telegramChatFolders, telegramChats, telegramMessages, telegramUsers } from '../schema.js';
import { procedureEnvelopeSchema } from '@agentg/shared/rpc/envelope';
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  asTdObject,
  normalizeChat,
  normalizeHistoricalMessage,
  type JsonObject,
  type TdObject
} from '../normalize.js';
import { persistTelegramUpdate, upsertChat } from '../store.js';
import { rpc, telegramRpcRouter } from './trpc.js';

const nonEmptyStringSchema = z.string().trim().min(1);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const positiveIntegerSchema = z.number().int().positive();

export const telegramHistoryChatSchema = z.object({
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
  id: z.string(),
  title: z.string(),
  type: z.string(),
  updatedAt: z.string()
});

export const telegramReadMessageSchema = z.object({
  chatId: z.string(),
  contentType: z.string(),
  deletedAt: z.string().nullable(),
  editDate: z.string().nullable(),
  isDeleted: z.boolean(),
  messageDate: z.string().nullable(),
  messageId: z.string(),
  senderId: z.string().nullable(),
  senderType: z.string().nullable(),
  text: z.string().nullable(),
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
  iconName: z.string().nullable(),
  id: nonNegativeIntegerSchema,
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

type TelegramClient = {
  invoke(request: Record<string, unknown>): Promise<unknown>;
};

type ChatListKind =
  | {
      kind: 'archive' | 'main';
    }
  | {
      folderId: number;
      kind: 'folder';
    };

type TelegramChatStorageRow = {
  raw: JsonObject;
  telegramChatId: string;
  title: string;
  type: string;
  updatedAt: Date;
};

type TelegramMessageStorageRow = {
  contentType: string;
  deletedAt: Date | null;
  editDate: Date | null;
  isDeleted: boolean;
  messageDate: Date | null;
  senderId: string | null;
  senderType: string | null;
  telegramChatId: string;
  telegramMessageId: string;
  text: string | null;
  updatedAt: Date;
};

type TelegramUserInfo = {
  isBot: boolean;
  isSelf: boolean;
  telegramUserId: string;
};

export type TelegramHistoryRouterRuntime = {
  client: TelegramClient;
  database: AppDatabase;
};

export function createTelegramHistoryRouter(runtime: TelegramHistoryRouterRuntime) {
  return telegramRpcRouter({
    countMessagesInIntervals: rpc
      .input(telegramCountMessagesInIntervalsInputSchema)
      .output(procedureEnvelopeSchema(telegramCountMessagesInIntervalsOutputSchema))
      .query(({ input }) => handleCountMessagesInIntervals(runtime, input)),
    fetchPage: rpc
      .input(telegramHistoryFetchPageInputSchema)
      .output(procedureEnvelopeSchema(telegramHistoryFetchPageResultSchema))
      .mutation(({ input }) => handleFetchPage(runtime, input)),
    getChat: rpc
      .input(telegramGetChatInputSchema)
      .output(procedureEnvelopeSchema(telegramGetChatOutputSchema))
      .query(({ input }) => handleGetChat(runtime, input)),
    getChatHistoryFacts: rpc
      .input(telegramGetChatHistoryFactsInputSchema)
      .output(procedureEnvelopeSchema(telegramGetChatHistoryFactsOutputSchema))
      .query(({ input }) => handleGetChatHistoryFacts(runtime, input)),
    getMessage: rpc
      .input(telegramGetMessageInputSchema)
      .output(procedureEnvelopeSchema(telegramGetMessageOutputSchema))
      .query(({ input }) => handleGetMessage(runtime, input)),
    listChatDirectory: rpc
      .input(telegramListChatDirectoryInputSchema)
      .output(procedureEnvelopeSchema(telegramListChatDirectoryOutputSchema))
      .query(({ input }) => handleListChatDirectory(runtime, input)),
    listChats: rpc
      .input(telegramHistoryListChatsInputSchema)
      .output(procedureEnvelopeSchema(z.array(telegramHistoryChatSchema)))
      .query(({ input }) => handleListChats(runtime, input)),
    listRecentMessages: rpc
      .input(telegramListRecentMessagesInputSchema)
      .output(procedureEnvelopeSchema(telegramListRecentMessagesOutputSchema))
      .query(({ input }) => handleListRecentMessages(runtime, input)),
    searchMessages: rpc
      .input(telegramSearchMessagesInputSchema)
      .output(procedureEnvelopeSchema(telegramSearchMessagesOutputSchema))
      .query(({ input }) => handleSearchMessages(runtime, input))
  });
}

export type TelegramHistoryRouter = ReturnType<typeof createTelegramHistoryRouter>;

async function handleListChats(
  runtime: TelegramHistoryRouterRuntime,
  input: TelegramHistoryListChatsRequest
): Promise<TelegramHistoryChat[]> {
  const { discover } = input;
  const loadBatchSize = parseLimit(input.loadBatchSize, 100, 1000);
  return discover === true
    ? discoverHistoryChats(runtime.database, runtime.client, loadBatchSize)
    : listKnownHistoryChats(runtime.database);
}

async function handleGetChat(
  runtime: TelegramHistoryRouterRuntime,
  input: TelegramGetChatInput
): Promise<{ chat: TelegramReadChat | null }> {
  const [chat] = await runtime.database
    .select({
      telegramChatId: telegramChats.telegramChatId,
      title: telegramChats.title,
      type: telegramChats.type,
      updatedAt: telegramChats.updatedAt
    })
    .from(telegramChats)
    .where(eq(telegramChats.telegramChatId, input.chatId))
    .limit(1);

  return {
    chat:
      chat === undefined
        ? null
        : {
            id: chat.telegramChatId,
            title: chat.title,
            type: chat.type,
            updatedAt: chat.updatedAt.toISOString()
          }
  };
}

async function handleGetMessage(
  runtime: TelegramHistoryRouterRuntime,
  input: TelegramGetMessageInput
): Promise<{ message: TelegramReadMessage | null }> {
  const [message] = await runtime.database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(
      and(
        eq(telegramMessages.telegramChatId, input.chatId),
        eq(telegramMessages.telegramMessageId, input.messageId)
      )
    )
    .limit(1);

  return {
    message: message === undefined ? null : toReadMessage(message)
  };
}

async function handleListRecentMessages(
  runtime: TelegramHistoryRouterRuntime,
  input: TelegramListRecentMessagesInput
): Promise<{ messages: TelegramReadMessage[] }> {
  const limit = parseLimit(input.limit, 50, 200);
  const where =
    input.chatId === undefined ? undefined : eq(telegramMessages.telegramChatId, input.chatId);
  const messages = await runtime.database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(where)
    .orderBy(
      desc(telegramMessages.messageDate),
      sql`${telegramMessages.telegramMessageId}::bigint desc`
    )
    .limit(limit);

  return {
    messages: messages.map(toReadMessage)
  };
}

async function handleSearchMessages(
  runtime: TelegramHistoryRouterRuntime,
  input: TelegramSearchMessagesInput
): Promise<{ messages: TelegramReadMessage[] }> {
  const query = input.query.trim();
  const limit = parseLimit(input.limit, 20, 100);
  const textFilter = ilike(telegramMessages.text, `%${query}%`);
  const where =
    input.chatId === undefined
      ? textFilter
      : and(eq(telegramMessages.telegramChatId, input.chatId), textFilter);
  const messages = await runtime.database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(where)
    .orderBy(
      desc(telegramMessages.messageDate),
      sql`${telegramMessages.telegramMessageId}::bigint desc`
    )
    .limit(limit);

  return {
    messages: messages.map(toReadMessage)
  };
}

async function handleListChatDirectory(
  runtime: TelegramHistoryRouterRuntime,
  input: TelegramListChatDirectoryInput
): Promise<TelegramListChatDirectoryOutput> {
  const query = input.query?.trim();
  const type = input.type?.trim();
  const queryWhere = query === undefined || query.length === 0 ? undefined : chatSearchWhere(query);
  const where = andSql(queryWhere, type === undefined ? undefined : eq(telegramChats.type, type));
  const navigationWhere = type === undefined ? undefined : eq(telegramChats.type, type);

  const [matchingChats, navigationChats, folders, types] = await Promise.all([
    runtime.database
      .select({
        raw: telegramChats.raw,
        telegramChatId: telegramChats.telegramChatId,
        title: telegramChats.title,
        type: telegramChats.type,
        updatedAt: telegramChats.updatedAt
      })
      .from(telegramChats)
      .where(where)
      .orderBy(asc(telegramChats.title), asc(telegramChats.telegramChatId)),
    runtime.database
      .select({
        raw: telegramChats.raw,
        telegramChatId: telegramChats.telegramChatId,
        title: telegramChats.title,
        type: telegramChats.type,
        updatedAt: telegramChats.updatedAt
      })
      .from(telegramChats)
      .where(navigationWhere)
      .orderBy(asc(telegramChats.title), asc(telegramChats.telegramChatId)),
    runtime.database
      .select({
        iconName: telegramChatFolders.iconName,
        position: telegramChatFolders.position,
        telegramChatFolderId: telegramChatFolders.telegramChatFolderId,
        title: telegramChatFolders.title
      })
      .from(telegramChatFolders)
      .orderBy(asc(telegramChatFolders.position), asc(telegramChatFolders.telegramChatFolderId)),
    runtime.database
      .select({
        count: sql<number>`count(*)::int`,
        type: telegramChats.type
      })
      .from(telegramChats)
      .groupBy(telegramChats.type)
      .orderBy(asc(telegramChats.type))
  ]);

  return {
    chats: await toDirectoryEntries(runtime.database, matchingChats),
    folders: folders.map((folder) => ({
      iconName: folder.iconName,
      id: folder.telegramChatFolderId,
      position: folder.position,
      title: folder.title
    })),
    navigationChats: await toDirectoryEntries(runtime.database, navigationChats),
    types
  };
}

async function handleGetChatHistoryFacts(
  runtime: TelegramHistoryRouterRuntime,
  input: TelegramGetChatHistoryFactsInput
): Promise<TelegramGetChatHistoryFactsOutput> {
  const [chat] = await runtime.database
    .select({
      raw: telegramChats.raw,
      telegramChatId: telegramChats.telegramChatId,
      title: telegramChats.title,
      type: telegramChats.type,
      updatedAt: telegramChats.updatedAt
    })
    .from(telegramChats)
    .where(eq(telegramChats.telegramChatId, input.chatId))
    .limit(1);

  if (chat === undefined) {
    return {
      chat: null,
      earliestMessageDate: null,
      messageCount: 0
    };
  }

  const [entries, earliestMessages, messageCounts] = await Promise.all([
    toDirectoryEntries(runtime.database, [chat]),
    runtime.database
      .select({
        messageDate: telegramMessages.messageDate
      })
      .from(telegramMessages)
      .where(
        and(
          eq(telegramMessages.telegramChatId, input.chatId),
          isNotNull(telegramMessages.messageDate)
        )
      )
      .orderBy(asc(telegramMessages.messageDate))
      .limit(1),
    runtime.database
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(telegramMessages)
      .where(eq(telegramMessages.telegramChatId, input.chatId))
  ]);

  return {
    chat: entries[0] ?? null,
    earliestMessageDate: earliestMessages[0]?.messageDate?.toISOString() ?? null,
    messageCount: messageCounts[0]?.count ?? 0
  };
}

async function handleCountMessagesInIntervals(
  runtime: TelegramHistoryRouterRuntime,
  input: TelegramCountMessagesInIntervalsInput
): Promise<TelegramCountMessagesInIntervalsOutput> {
  const intervals = input.intervals.map((interval) => ({
    endAt: requireDate(interval.endAt, 'telegram.countMessagesInIntervals requires endAt'),
    startAt: requireDate(interval.startAt, 'telegram.countMessagesInIntervals requires startAt')
  }));

  return {
    counts: await Promise.all(
      intervals.map(async (interval) => {
        const [row] = await runtime.database
          .select({
            count: sql<number>`count(*)::int`
          })
          .from(telegramMessages)
          .where(
            and(
              eq(telegramMessages.telegramChatId, input.chatId),
              isNotNull(telegramMessages.messageDate),
              gte(telegramMessages.messageDate, interval.startAt),
              lt(telegramMessages.messageDate, interval.endAt)
            )
          );

        return row?.count ?? 0;
      })
    )
  };
}

async function handleFetchPage(
  runtime: TelegramHistoryRouterRuntime,
  input: TelegramHistoryFetchPageRequest
): Promise<TelegramHistoryFetchPageResult> {
  const chatId = parseTelegramChatId(input.chatId);
  const startAt = requireDate(input.startAt, 'telegram.history.fetch_page requires startAt');
  const endAt = requireDate(input.endAt, 'telegram.history.fetch_page requires endAt');
  const limit = parseLimit(input.limit, 100, 100);
  let cursorMessageId = optionalTelegramMessageId(input.cursorMessageId);

  if (cursorMessageId === undefined) {
    const anchor = await getLastMessageNoLaterThan(runtime.client, chatId, endAt);
    const anchorDate = tdMessageDate(anchor);
    const anchorMessageId = tdMessageId(anchor);

    if (anchor === undefined || anchorMessageId === undefined) {
      return {
        fetchedMessages: 0,
        kind: 'no_messages_before_end',
        storedMessages: 0
      };
    }

    if (anchorDate !== undefined && anchorDate < startAt) {
      return {
        anchorMessageDate: anchorDate.toISOString(),
        fetchedMessages: 0,
        kind: 'anchor_before_start',
        storedMessages: 0
      };
    }

    cursorMessageId = anchorMessageId;
  }

  const history = asTdObject(
    await invokeTdlib(runtime.client, {
      _: 'getChatHistory',
      chat_id: chatId,
      from_message_id: cursorMessageId,
      limit,
      offset: 0,
      only_local: false
    })
  );
  const messages = Array.isArray(history?.messages) ? history.messages.map(asTdObject) : [];
  const concreteMessages = messages.filter(isTdObject);

  if (concreteMessages.length === 0) {
    return {
      fetchedMessages: 0,
      kind: 'no_messages_before_end',
      storedMessages: 0
    };
  }

  let storedMessages = 0;
  for (const message of concreteMessages) {
    const messageDate = tdMessageDate(message);
    if (messageDate === undefined || messageDate < startAt || messageDate >= endAt) {
      continue;
    }

    const normalized = normalizeHistoricalMessage(message);
    if (normalized === undefined) {
      continue;
    }

    const result = await persistTelegramUpdate(runtime.database, normalized);
    if (result.message) {
      storedMessages += 1;
    }
  }

  const nextCursorMessageId = oldestMessageIdOlderThan(concreteMessages, cursorMessageId);
  const oldestFetchedMessageDate =
    nextCursorMessageId === undefined
      ? undefined
      : messageDateForId(concreteMessages, nextCursorMessageId);

  return {
    crossedStart: concreteMessages.some((message) => isBeforeInterval(message, startAt)),
    fetchedMessages: concreteMessages.length,
    kind: 'page',
    ...(nextCursorMessageId === undefined ? {} : { nextCursorMessageId }),
    ...(oldestFetchedMessageDate === undefined
      ? {}
      : { oldestFetchedMessageDate: oldestFetchedMessageDate.toISOString() }),
    reachedBeginning: nextCursorMessageId === undefined,
    storedMessages
  };
}

async function discoverHistoryChats(
  database: AppDatabase,
  client: TelegramClient,
  loadBatchSize: number
): Promise<TelegramHistoryChat[]> {
  const folderIds = await listKnownFolderIds(database);
  await loadAllChats(client, loadBatchSize, folderIds);
  const chatIds = dedupeTelegramIds([
    ...(await getChatIds(client, { kind: 'main' }, 100000)),
    ...(await getChatIds(client, { kind: 'archive' }, 100000)),
    ...(await getFolderChatIds(client, folderIds, 100000))
  ]);
  const chats: TelegramHistoryChat[] = [];

  for (const chatId of chatIds) {
    const chat = await getChatOrUndefined(client, chatId);
    const normalized = normalizeChat(chat);
    if (normalized === undefined) {
      continue;
    }

    await upsertChat(database, normalized);
    if (isHistorySyncChatType(normalized.type)) {
      chats.push({
        id: normalized.id,
        title: normalized.title,
        type: normalized.type
      });
    }
  }

  return chats;
}

async function listKnownHistoryChats(database: AppDatabase): Promise<TelegramHistoryChat[]> {
  const rows = await database
    .select({
      id: telegramChats.telegramChatId,
      raw: telegramChats.raw,
      title: telegramChats.title,
      type: telegramChats.type
    })
    .from(telegramChats)
    .orderBy(asc(telegramChats.telegramChatId));

  return rows
    .filter((row) => isHistorySyncChatType(row.type))
    .map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type
    }));
}

async function listKnownFolderIds(database: AppDatabase): Promise<number[]> {
  const rows = await database
    .select({
      id: telegramChatFolders.telegramChatFolderId
    })
    .from(telegramChatFolders)
    .orderBy(asc(telegramChatFolders.telegramChatFolderId));

  return rows.map((row) => row.id);
}

async function loadAllChats(
  client: TelegramClient,
  batchSize: number,
  folderIds: number[]
): Promise<void> {
  await loadAllChatsFromList(client, { kind: 'main' }, batchSize);
  await loadAllChatsFromList(client, { kind: 'archive' }, batchSize);
  for (const folderId of folderIds) {
    await loadAllChatsFromList(client, { folderId, kind: 'folder' }, batchSize);
  }
}

async function loadAllChatsFromList(
  client: TelegramClient,
  chatList: ChatListKind,
  batchSize: number
): Promise<void> {
  for (;;) {
    try {
      await invokeTdlib(client, {
        _: 'loadChats',
        chat_list: toTdChatList(chatList),
        limit: batchSize
      });
    } catch (error) {
      if (isTdlibNotFound(error)) {
        return;
      }

      throw error;
    }
  }
}

async function getChatIds(
  client: TelegramClient,
  chatList: ChatListKind,
  limit: number
): Promise<number[]> {
  let chats: TdObject | undefined;
  try {
    chats = asTdObject(
      await invokeTdlib(client, {
        _: 'getChats',
        chat_list: toTdChatList(chatList),
        limit
      })
    );
  } catch (error) {
    if (isOptionalChatListNotFound(chatList, error)) {
      return [];
    }

    throw error;
  }

  return Array.isArray(chats?.chat_ids) ? chats.chat_ids.filter(isTelegramId) : [];
}

async function getFolderChatIds(
  client: TelegramClient,
  folderIds: number[],
  limit: number
): Promise<number[]> {
  const chatIds: number[] = [];
  for (const folderId of folderIds) {
    chatIds.push(...(await getChatIds(client, { folderId, kind: 'folder' }, limit)));
  }
  return chatIds;
}

async function getChatOrUndefined(
  client: TelegramClient,
  chatId: number
): Promise<TdObject | undefined> {
  try {
    return asTdObject(await invokeTdlib(client, { _: 'getChat', chat_id: chatId }));
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

async function getLastMessageNoLaterThan(
  client: TelegramClient,
  chatId: number,
  end: Date
): Promise<TdObject | undefined> {
  try {
    return asTdObject(
      await invokeTdlib(client, {
        _: 'getChatMessageByDate',
        chat_id: chatId,
        date: Math.floor((end.getTime() - 1) / 1000)
      })
    );
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

async function invokeTdlib(client: TelegramClient, request: TdObject): Promise<unknown> {
  for (;;) {
    try {
      return await client.invoke(request);
    } catch (error) {
      const floodWaitSeconds = parseFloodWaitSeconds(error);
      if (floodWaitSeconds === undefined) {
        throw error;
      }

      console.warn(
        JSON.stringify({
          event: 'telegram.flood_wait',
          request: request._,
          seconds: floodWaitSeconds
        })
      );
      await delay((floodWaitSeconds + 1) * 1000);
    }
  }
}

function parseTelegramChatId(value: string): number {
  const text = requireString(value, 'telegram.history.fetch_page requires chatId');
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Telegram chat id must be numeric: ${text}`);
  }
  return parsed;
}

function optionalTelegramMessageId(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(`Telegram message id must be numeric: ${String(value)}`);
  }
  return value;
}

function requireDate(value: unknown, message: string): Date {
  const text = requireString(value, message);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new Error(message);
  }
  return date;
}

function requireString(value: unknown, message: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  throw new Error(message);
}

function parseLimit(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return fallback;
  }

  return Math.min(value, max);
}

function readMessageSelection() {
  return {
    contentType: telegramMessages.contentType,
    deletedAt: telegramMessages.deletedAt,
    editDate: telegramMessages.editDate,
    isDeleted: telegramMessages.isDeleted,
    messageDate: telegramMessages.messageDate,
    senderId: telegramMessages.senderId,
    senderType: telegramMessages.senderType,
    telegramChatId: telegramMessages.telegramChatId,
    telegramMessageId: telegramMessages.telegramMessageId,
    text: telegramMessages.text,
    updatedAt: telegramMessages.updatedAt
  };
}

function toReadMessage(message: TelegramMessageStorageRow): TelegramReadMessage {
  return {
    chatId: message.telegramChatId,
    contentType: message.contentType,
    deletedAt: toNullableIsoString(message.deletedAt),
    editDate: toNullableIsoString(message.editDate),
    isDeleted: message.isDeleted,
    messageDate: toNullableIsoString(message.messageDate),
    messageId: message.telegramMessageId,
    senderId: message.senderId,
    senderType: message.senderType,
    text: message.text,
    updatedAt: message.updatedAt.toISOString()
  };
}

async function toDirectoryEntries(
  database: AppDatabase,
  chats: TelegramChatStorageRow[]
): Promise<TelegramChatDirectoryEntry[]> {
  const userIds = chats.map((chat) => telegramChatUserId(chat.raw)).filter(isDefined);
  const users =
    userIds.length === 0
      ? []
      : await database
          .select({
            isBot: telegramUsers.isBot,
            isSelf: telegramUsers.isSelf,
            telegramUserId: telegramUsers.telegramUserId
          })
          .from(telegramUsers)
          .where(inArray(telegramUsers.telegramUserId, userIds));
  const usersById = new Map(users.map((user) => [user.telegramUserId, user]));

  return chats.map((chat) => {
    const user = usersById.get(telegramChatUserId(chat.raw) ?? '');
    return toDirectoryEntry(chat, user);
  });
}

function toDirectoryEntry(
  chat: TelegramChatStorageRow,
  user: TelegramUserInfo | undefined
): TelegramChatDirectoryEntry {
  return {
    id: chat.telegramChatId,
    isBot: user?.isBot === true,
    isSelf: user?.isSelf === true,
    lastMessageDate: telegramChatLastMessageDate(chat.raw),
    placements: telegramChatPlacements(chat.raw),
    title: chat.type === 'private' && user?.isSelf === true ? 'Saved Messages' : chat.title,
    type: chat.type,
    updatedAt: chat.updatedAt.toISOString()
  };
}

function telegramChatPlacements(raw: JsonObject): TelegramChatPlacement[] {
  return chatPositions(raw)
    .map((position) => {
      const list = asPlainRecord(position.list);
      const order = parsePositiveBigInt(position.order);
      if (list === undefined || order === undefined) {
        return undefined;
      }

      const type = typeof list._ === 'string' ? list._ : undefined;
      if (type === 'chatListMain') {
        return {
          kind: 'main' as const,
          order: order.toString()
        };
      }
      if (type === 'chatListArchive') {
        return {
          kind: 'archive' as const,
          order: order.toString()
        };
      }
      if (type === 'chatListFolder') {
        const folderId = chatFolderId(list);
        return folderId === undefined
          ? undefined
          : {
              folderId,
              kind: 'folder' as const,
              order: order.toString()
            };
      }

      return undefined;
    })
    .filter(isDefined);
}

function chatPositions(raw: JsonObject): Record<string, unknown>[] {
  return (Array.isArray(raw.positions) ? raw.positions : []).map(asPlainRecord).filter(isDefined);
}

function chatFolderId(list: Record<string, unknown> | undefined): number | undefined {
  const value = list?.chat_folder_id ?? list?.chatFolderId;
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function telegramChatLastMessageDate(raw: JsonObject): number {
  const lastMessage = asPlainRecord(raw.last_message) ?? asPlainRecord(raw.lastMessage);
  return typeof lastMessage?.date === 'number' && lastMessage.date > 0 ? lastMessage.date : 0;
}

function telegramChatUserId(raw: JsonObject): string | undefined {
  const type = asPlainRecord(raw.type);
  const userId = type?.user_id ?? type?.userId;
  if (typeof userId === 'number' || typeof userId === 'string') {
    return String(userId);
  }
  return undefined;
}

function parsePositiveBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return BigInt(value);
  }

  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : undefined;
  }

  return undefined;
}

function chatSearchWhere(query: string) {
  return orSql(
    ilike(telegramChats.title, `%${query}%`),
    ilike(telegramChats.telegramChatId, `%${query}%`)
  );
}

function andSql(...conditions: (ReturnType<typeof eq> | undefined)[]) {
  const defined = conditions.filter((condition) => condition !== undefined);
  return defined.length === 0 ? undefined : and(...defined);
}

function orSql(first: ReturnType<typeof ilike>, second: ReturnType<typeof ilike>) {
  return sql`(${first} or ${second})`;
}

function toNullableIsoString(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

function toTdChatList(chatList: ChatListKind): TdObject {
  switch (chatList.kind) {
    case 'main':
      return { _: 'chatListMain' };
    case 'archive':
      return { _: 'chatListArchive' };
    case 'folder':
      return { _: 'chatListFolder', chat_folder_id: chatList.folderId };
  }
}

function isOptionalChatListNotFound(chatList: ChatListKind, error: unknown): boolean {
  return chatList.kind !== 'main' && isTdlibNotFound(error);
}

function isHistorySyncChatType(type: string): boolean {
  return type === 'private' || type === 'secret' || type === 'group' || type === 'channel';
}

function tdMessageId(message: TdObject | undefined): number | undefined {
  return typeof message?.id === 'number' ? message.id : undefined;
}

function tdMessageDate(message: TdObject | undefined): Date | undefined {
  return typeof message?.date === 'number' && message.date > 0
    ? new Date(message.date * 1000)
    : undefined;
}

function isBeforeInterval(message: TdObject, startAt: Date): boolean {
  const messageDate = tdMessageDate(message);
  return messageDate !== undefined && messageDate < startAt;
}

function messageDateForId(messages: TdObject[], messageId: number): Date | undefined {
  return tdMessageDate(messages.find((message) => tdMessageId(message) === messageId));
}

function oldestMessageIdOlderThan(
  messages: TdObject[],
  cursorMessageId: number
): number | undefined {
  const ids = messages
    .map(tdMessageId)
    .filter((id): id is number => id !== undefined && id < cursorMessageId);

  return ids.length === 0 ? undefined : Math.min(...ids);
}

function parseFloodWaitSeconds(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = /FLOOD(?:_PREMIUM)?_WAIT_(\d+)/.exec(message);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}

function isTdObject(value: TdObject | undefined): value is TdObject {
  return value !== undefined;
}

function isTelegramId(value: unknown): value is number {
  return typeof value === 'number';
}

function dedupeTelegramIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
