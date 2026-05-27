import { asc } from 'drizzle-orm';

import type { TelegramHistoryChat, TelegramHistoryListChatsRequest } from '../rpc/contracts.js';
import { telegramChatFolderInfos, telegramChats } from '../schema.js';
import { storeChat, telegramChatType } from '../telegram-store/chat.js';
import { storeMessage } from '../telegram-store/message.js';
import type { TelegramProcedureHandlerContext } from '../telegram-procedure-runtime/context.js';
import { readChatSelection, toTelegramChatStorageRow } from '../telegram-read-model/chat.js';
import {
  listableDirectoryEntries,
  telegramChatPlacements,
  toDirectoryEntries
} from '../telegram-read-model/directory.js';
import { telegramWireJsonObject } from '../telegramWire.js';
import { parseLimit } from './helpers.js';
import { getChatIds, getChatOrUndefined, loadAllChats } from './tdlibOperations.js';

export async function handleListChats(
  context: TelegramProcedureHandlerContext,
  input: TelegramHistoryListChatsRequest
): Promise<TelegramHistoryChat[]> {
  const { discover } = input;
  const loadBatchSize = parseLimit(input.loadBatchSize, 100, 1000);
  return discover === true
    ? discoverHistoryChats(context, loadBatchSize)
    : listKnownHistoryChats(context);
}

async function discoverHistoryChats(
  context: TelegramProcedureHandlerContext,
  loadBatchSize: number
): Promise<TelegramHistoryChat[]> {
  const folderIds = await listKnownFolderIds(context);
  await loadAllChats(context, loadBatchSize, folderIds);
  const chatIds = dedupeTelegramIds([
    ...(await getChatIds(context, { kind: 'main' }, 100000)),
    ...(await getChatIds(context, { kind: 'archive' }, 100000)),
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
}: TelegramProcedureHandlerContext): Promise<TelegramHistoryChat[]> {
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
  context: TelegramProcedureHandlerContext,
  folderIds: number[],
  limit: number
): Promise<number[]> {
  const chatIds: number[] = [];
  for (const folderId of folderIds) {
    chatIds.push(...(await getChatIds(context, { folderId, kind: 'folder' }, limit)));
  }
  return chatIds;
}

async function listKnownFolderIds({
  database
}: TelegramProcedureHandlerContext): Promise<number[]> {
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
