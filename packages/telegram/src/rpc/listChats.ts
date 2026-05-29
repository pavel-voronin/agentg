import { query } from '@agentg/framework';
import { z } from 'zod';
import type { ChatList$Input } from 'tdlib-types';
import { asc } from 'drizzle-orm';
import {
  telegramChatFolderInfos,
  telegramChatPositions,
  telegramChats
} from '../database/schema.js';
import { useDatabase } from '../database/subsystem.js';
import { storeChat, telegramChatType } from '../store/chat.js';
import { storeMessage } from '../store/message.js';
import { readChatSelection, toTelegramChatStorageRow } from '../read-model/chat.js';
import { isListableTelegramChat } from '../read-model/chatPlacements.js';
import { telegramTdlibPriorities } from '../tdlib/priority.js';
import { useTdlib } from '../tdlib/subsystem.js';
import { telegramWireJsonObject } from '../tdlib/wire.js';
import { parseLimit } from '@agentg/framework';

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

export type TelegramHistoryChat = z.infer<typeof telegramHistoryChatSchema>;
export type TelegramHistoryListChatsRequest = z.infer<typeof telegramHistoryListChatsInputSchema>;

type ChatListKind =
  | {
      kind: 'archive' | 'main';
    }
  | {
      folderId: number;
      kind: 'folder';
    };

export const listChats = query((procedure) =>
  procedure
    .input(telegramHistoryListChatsInputSchema)
    .output(z.array(telegramHistoryChatSchema))
    .query(({ input }) => runListChats(input))
);

async function runListChats(
  input: TelegramHistoryListChatsRequest
): Promise<TelegramHistoryChat[]> {
  const { discover } = input;
  const loadBatchSize = parseLimit(input.loadBatchSize, 100, 1000);
  return discover === true ? discoverHistoryChats(loadBatchSize) : listKnownHistoryChats();
}

async function discoverHistoryChats(loadBatchSize: number): Promise<TelegramHistoryChat[]> {
  const database = useDatabase();
  const folderIds = await listKnownFolderIds();
  await loadAllChatsFromKnownLists(loadBatchSize, folderIds);
  const chatIds = dedupeTelegramIds([
    ...(await getChatIdsFromList({ kind: 'main' }, 100000)),
    ...(await getChatIdsFromList({ kind: 'archive' }, 100000)),
    ...(await getFolderChatIds(folderIds, 100000))
  ]);
  const chats: TelegramHistoryChat[] = [];

  for (const chatId of chatIds) {
    const chat = await getChatOrUndefined(chatId);
    if (chat === undefined) {
      continue;
    }
    if (!isListableChat(telegramWireJsonObject(chat))) {
      continue;
    }
    const lastMessage = chat.last_message ?? null;

    await database.transaction(async (transaction) => {
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

async function listKnownHistoryChats(): Promise<TelegramHistoryChat[]> {
  const database = useDatabase();
  const rows = await database
    .select(readChatSelection())
    .from(telegramChats)
    .orderBy(asc(telegramChats.id));
  const placementRows = await database
    .select({
      chatId: telegramChatPositions.chatId
    })
    .from(telegramChatPositions);
  const listableChatIds = new Set(placementRows.map((row) => row.chatId));

  return rows
    .map(toTelegramChatStorageRow)
    .filter((chat) => listableChatIds.has(chat.telegramChatId))
    .filter((chat) => isHistorySyncChatType(chat.type))
    .map((chat) => ({
      _model: 'telegram.chat',
      id: chat.telegramChatId,
      title: chat.title,
      type: chat.type
    }));
}

async function getFolderChatIds(folderIds: number[], limit: number): Promise<number[]> {
  const chatIds: number[] = [];
  for (const folderId of folderIds) {
    chatIds.push(...(await getChatIdsFromList({ folderId, kind: 'folder' }, limit)));
  }
  return chatIds;
}

async function listKnownFolderIds(): Promise<number[]> {
  const database = useDatabase();
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
  return isListableTelegramChat(chat);
}

function dedupeTelegramIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

async function loadAllChatsFromKnownLists(batchSize: number, folderIds: number[]): Promise<void> {
  await loadChatsFromList({ kind: 'main' }, batchSize);
  await loadChatsFromList({ kind: 'archive' }, batchSize);
  for (const folderId of folderIds) {
    await loadChatsFromList({ folderId, kind: 'folder' }, batchSize);
  }
}

async function loadChatsFromList(chatList: ChatListKind, batchSize: number): Promise<void> {
  const tdlib = useTdlib();
  for (;;) {
    try {
      await tdlib.loadChats(
        {
          chatList: toTdChatList(chatList),
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

async function getChatIdsFromList(chatList: ChatListKind, limit: number): Promise<number[]> {
  try {
    const tdlib = useTdlib();
    const chats = await tdlib.getChats(
      {
        chatList: toTdChatList(chatList),
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
  chatId: number
): Promise<Awaited<ReturnType<ReturnType<typeof useTdlib>['getChat']>> | undefined> {
  try {
    const tdlib = useTdlib();
    return await tdlib.getChat(
      { chatId },
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
