import { query } from '@agentg/rpc/surface';
import { z } from 'zod';
import type { ChatList$Input } from 'tdlib-types';
import { telegramHistoryChatSchema, telegramHistoryListChatsInputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { asc } from 'drizzle-orm';
import type { TelegramHistoryChat, TelegramHistoryListChatsRequest } from '../contracts.js';
import { telegramChatFolderInfos, telegramChats } from '../../schema.js';
import { storeChat, telegramChatType } from '../../telegram-store/chat.js';
import { storeMessage } from '../../telegram-store/message.js';
import type { TelegramProcedureContext } from '../../telegram-procedure-runtime/context.js';
import { readChatSelection, toTelegramChatStorageRow } from '../../telegram-read-model/chat.js';
import {
  listableDirectoryEntries,
  telegramChatPlacements,
  toDirectoryEntries
} from '../../telegram-read-model/directory.js';
import { telegramTdlibPriorities } from '../../telegramTdlibPriority.js';
import { telegramWireJsonObject } from '../../telegramWire.js';
import { parseLimit } from '../../telegramProcedureInputs.js';
import { getChat, getChats, loadChats } from '../../telegramTdlibOperations.js';

type ChatListKind =
  | {
      kind: 'archive' | 'main';
    }
  | {
      folderId: number;
      kind: 'folder';
    };

export const listChats = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramHistoryListChatsInputSchema)
    .output(z.array(telegramHistoryChatSchema))
    .query(({ input }) => runListChats(runtime, input))
);

async function runListChats(
  context: TelegramProcedureContext,
  input: TelegramHistoryListChatsRequest
): Promise<TelegramHistoryChat[]> {
  const { discover } = input;
  const loadBatchSize = parseLimit(input.loadBatchSize, 100, 1000);
  return discover === true
    ? discoverHistoryChats(context, loadBatchSize)
    : listKnownHistoryChats(context);
}

async function discoverHistoryChats(
  context: TelegramProcedureContext,
  loadBatchSize: number
): Promise<TelegramHistoryChat[]> {
  const folderIds = await listKnownFolderIds(context);
  await loadAllChatsFromKnownLists(context, loadBatchSize, folderIds);
  const chatIds = dedupeTelegramIds([
    ...(await getChatIdsFromList(context, { kind: 'main' }, 100000)),
    ...(await getChatIdsFromList(context, { kind: 'archive' }, 100000)),
    ...(await getFolderChatIds(context, folderIds, 100000))
  ]);
  const chats: TelegramHistoryChat[] = [];

  for (const chatId of chatIds) {
    const chat = await getChatOrUndefined(context, chatId);
    if (chat === undefined) {
      continue;
    }
    if (!isListableChat(telegramWireJsonObject(chat))) {
      continue;
    }
    const lastMessage = chat.last_message ?? null;

    await context.database.transaction(async (transaction) => {
      if (lastMessage !== null) {
        await storeMessage(transaction, lastMessage);
      }

      await storeChat(transaction, chat);
    });
    const type = telegramChatType(chat);
    if (isHistorySyncChatType(type)) {
      chats.push({
        _model: 'telegram.chat',
        id: String(chat.id),
        title: chat.title,
        type
      });
    }
  }

  return chats;
}

async function listKnownHistoryChats({
  database
}: TelegramProcedureContext): Promise<TelegramHistoryChat[]> {
  const rows = await database
    .select(readChatSelection())
    .from(telegramChats)
    .orderBy(asc(telegramChats.id));
  const entries = listableDirectoryEntries(
    await toDirectoryEntries(database, rows.map(toTelegramChatStorageRow))
  );

  return entries
    .filter((entry) => isHistorySyncChatType(entry.type))
    .map((entry) => ({
      _model: 'telegram.chat',
      id: entry.id,
      title: entry.title,
      type: entry.type
    }));
}

async function getFolderChatIds(
  context: TelegramProcedureContext,
  folderIds: number[],
  limit: number
): Promise<number[]> {
  const chatIds: number[] = [];
  for (const folderId of folderIds) {
    chatIds.push(...(await getChatIdsFromList(context, { folderId, kind: 'folder' }, limit)));
  }
  return chatIds;
}

async function listKnownFolderIds({ database }: TelegramProcedureContext): Promise<number[]> {
  const rows = await database
    .select({
      folderId: telegramChatFolderInfos.id
    })
    .from(telegramChatFolderInfos)
    .orderBy(asc(telegramChatFolderInfos.position), asc(telegramChatFolderInfos.id));

  return rows.map((row) => row.folderId);
}

function isHistorySyncChatType(type: string): boolean {
  return type === 'private' || type === 'secret' || type === 'group' || type === 'channel';
}

function isListableChat(chat: ReturnType<typeof telegramWireJsonObject>): boolean {
  return telegramChatPlacements(chat).length > 0;
}

function dedupeTelegramIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

async function loadAllChatsFromKnownLists(
  context: TelegramProcedureContext,
  batchSize: number,
  folderIds: number[]
): Promise<void> {
  await loadChatsFromList(context, { kind: 'main' }, batchSize);
  await loadChatsFromList(context, { kind: 'archive' }, batchSize);
  for (const folderId of folderIds) {
    await loadChatsFromList(context, { folderId, kind: 'folder' }, batchSize);
  }
}

async function loadChatsFromList(
  context: TelegramProcedureContext,
  chatList: ChatListKind,
  batchSize: number
): Promise<void> {
  for (;;) {
    try {
      await loadChats(
        context,
        {
          _: 'loadChats',
          chat_list: toTdChatList(chatList),
          limit: batchSize
        },
        { priority: telegramTdlibPriorities.maximum }
      );
    } catch (error) {
      if (isTdlibNotFound(error)) {
        return;
      }

      throw error;
    }
  }
}

async function getChatIdsFromList(
  context: TelegramProcedureContext,
  chatList: ChatListKind,
  limit: number
): Promise<number[]> {
  try {
    const chats = await getChats(
      context,
      {
        _: 'getChats',
        chat_list: toTdChatList(chatList),
        limit
      },
      { priority: telegramTdlibPriorities.maximum }
    );
    return chats.chat_ids;
  } catch (error) {
    if (chatList.kind !== 'main' && isTdlibNotFound(error)) {
      return [];
    }

    throw error;
  }
}

async function getChatOrUndefined(
  context: TelegramProcedureContext,
  chatId: number
): Promise<Awaited<ReturnType<typeof getChat>> | undefined> {
  try {
    return await getChat(
      context,
      { _: 'getChat', chat_id: chatId },
      {
        priority: telegramTdlibPriorities.maximum
      }
    );
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

function toTdChatList(chatList: ChatListKind): ChatList$Input {
  switch (chatList.kind) {
    case 'main':
      return { _: 'chatListMain' };
    case 'archive':
      return { _: 'chatListArchive' };
    case 'folder':
      return { _: 'chatListFolder', chat_folder_id: chatList.folderId };
  }
}

function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}
