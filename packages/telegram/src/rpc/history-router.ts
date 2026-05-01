import type { AppDatabase } from '@agentg/database/client';
import { telegramChatFolders, telegramChats } from '@agentg/database/schema';
import { asc } from 'drizzle-orm';
import { z } from 'zod';

import {
  asTdObject,
  normalizeChat,
  normalizeHistoricalMessage,
  type TdObject
} from '../normalize.js';
import { persistTelegramUpdate, upsertChat } from '../store.js';
import { telegramRpcProcedure, telegramRpcRouter } from './trpc.js';

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

export type TelegramHistoryChat = z.infer<typeof telegramHistoryChatSchema>;
export type TelegramHistoryListChatsRequest = z.infer<typeof telegramHistoryListChatsInputSchema>;
export type TelegramHistoryFetchPageRequest = z.infer<typeof telegramHistoryFetchPageInputSchema>;
export type TelegramHistoryFetchPageResult = z.infer<typeof telegramHistoryFetchPageResultSchema>;

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

export type TelegramHistoryRouterRuntime = {
  client: TelegramClient;
  database: AppDatabase;
};

export function createTelegramHistoryRouter(runtime: TelegramHistoryRouterRuntime) {
  return telegramRpcRouter({
    fetchPage: telegramRpcProcedure
      .input(telegramHistoryFetchPageInputSchema)
      .output(telegramHistoryFetchPageResultSchema)
      .mutation(({ input }) => handleFetchPage(runtime, input)),
    listChats: telegramRpcProcedure
      .input(telegramHistoryListChatsInputSchema)
      .output(z.array(telegramHistoryChatSchema))
      .query(({ input }) => handleListChats(runtime, input))
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

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
