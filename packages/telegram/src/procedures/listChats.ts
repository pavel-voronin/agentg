import { parseLimit } from '@agentg/framework';
import { asc } from 'drizzle-orm';
import type { chat as Chat, ChatList$Input } from 'tdlib-types';
import { z } from 'zod';

import {
  telegramChatFolderInfos,
  telegramChatPositions,
  telegramChats
} from '../database/schema.js';
import { storeChat, telegramChatType } from '../store/chat.js';
import { storeMessage } from '../store/message.js';
import { priorities } from '../tdlib/priority.js';
import { tdJsonObject } from '../tdlib/value.js';
import { readChatSelection, toChatStorageRow } from '../views/chat.js';
import { isListableChat } from '../views/chatPlacement.js';
import type { ProcedureResources } from './resources.js';

const chatSchema = z.object({
  _model: z.literal('telegram.chat'),
  id: z.string(),
  title: z.string(),
  type: z.string()
});

const inputSchema = z
  .object({
    discover: z.boolean().optional(),
    loadBatchSize: z.number().int().positive().optional()
  })
  .default({});

const outputSchema = z.array(chatSchema);

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

type ChatListKind =
  | {
      kind: 'archive' | 'main';
    }
  | {
      folderId: number;
      kind: 'folder';
    };

export function listChatsProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<Output> => {
    const output = await runListChats(inputSchema.parse(input), resources);
    return outputSchema.parse(output);
  };
}

async function runListChats(input: Input, resources: ProcedureResources): Promise<Output> {
  const loadBatchSize = parseLimit(input.loadBatchSize, 100, 1000);
  return input.discover === true
    ? discoverHistoryChats(loadBatchSize, resources)
    : listKnownHistoryChats(resources);
}

async function discoverHistoryChats(
  loadBatchSize: number,
  resources: ProcedureResources
): Promise<Output> {
  const folderIds = await listKnownFolderIds(resources);
  await loadAllChatsFromKnownLists(loadBatchSize, folderIds, resources);
  const chatIds = dedupeIds([
    ...(await getChatIdsFromList({ kind: 'main' }, 100000, resources)),
    ...(await getChatIdsFromList({ kind: 'archive' }, 100000, resources)),
    ...(await getFolderChatIds(folderIds, 100000, resources))
  ]);
  const chats: Output = [];

  for (const chatId of chatIds) {
    const chat = await getChatOrUndefined(chatId, resources);
    if (chat === undefined || !isListableChat(tdJsonObject(chat))) {
      continue;
    }
    const lastMessage = chat.last_message ?? null;

    await resources.database.transaction(async (transaction) => {
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

async function listKnownHistoryChats(resources: ProcedureResources): Promise<Output> {
  const rows = await resources.database
    .select(readChatSelection())
    .from(telegramChats)
    .orderBy(asc(telegramChats.id));
  const placementRows = await resources.database
    .select({
      chatId: telegramChatPositions.chatId
    })
    .from(telegramChatPositions);
  const listableChatIds = new Set(placementRows.map((row) => row.chatId));

  return rows
    .map(toChatStorageRow)
    .filter((chat) => listableChatIds.has(chat.telegramChatId))
    .filter((chat) => isHistorySyncChatType(chat.type))
    .map((chat) => ({
      _model: 'telegram.chat',
      id: chat.telegramChatId,
      title: chat.title,
      type: chat.type
    }));
}

async function getFolderChatIds(
  folderIds: number[],
  limit: number,
  resources: ProcedureResources
): Promise<number[]> {
  const chatIds: number[] = [];
  for (const folderId of folderIds) {
    chatIds.push(...(await getChatIdsFromList({ folderId, kind: 'folder' }, limit, resources)));
  }
  return chatIds;
}

async function listKnownFolderIds(resources: ProcedureResources): Promise<number[]> {
  const rows = await resources.database
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

function dedupeIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

async function loadAllChatsFromKnownLists(
  batchSize: number,
  folderIds: number[],
  resources: ProcedureResources
): Promise<void> {
  await loadChatsFromList({ kind: 'main' }, batchSize, resources);
  await loadChatsFromList({ kind: 'archive' }, batchSize, resources);
  for (const folderId of folderIds) {
    await loadChatsFromList({ folderId, kind: 'folder' }, batchSize, resources);
  }
}

async function loadChatsFromList(
  chatList: ChatListKind,
  batchSize: number,
  resources: ProcedureResources
): Promise<void> {
  for (;;) {
    try {
      await resources.tdlib.loadChats(
        {
          chatList: toTdChatList(chatList),
          limit: batchSize
        },
        { priority: priorities.maximum }
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
  chatList: ChatListKind,
  limit: number,
  resources: ProcedureResources
): Promise<number[]> {
  try {
    const chats = await resources.tdlib.getChats(
      {
        chatList: toTdChatList(chatList),
        limit
      },
      { priority: priorities.maximum }
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
  chatId: number,
  resources: ProcedureResources
): Promise<Chat | undefined> {
  try {
    return await resources.tdlib.getChat(
      { chatId },
      {
        priority: priorities.maximum
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
