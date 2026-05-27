import { query } from '@agentg/rpc/surface';
import {
  telegramListChatDirectoryInputSchema,
  telegramListChatDirectoryOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { asc, sql } from 'drizzle-orm';
import type {
  TelegramChatFolder,
  TelegramListChatDirectoryInput,
  TelegramListChatDirectoryOutput
} from '../contracts.js';
import { telegramChatFolderInfos, telegramChats } from '../../schema.js';
import type { TelegramProcedureContext } from '../../telegram-procedure-runtime/context.js';
import {
  chatSearchWhere,
  readChatSelection,
  toTelegramChatStorageRow
} from '../../telegram-read-model/chat.js';
import {
  chatFolderEntry,
  chatTypeCounts,
  listableDirectoryEntries,
  toDirectoryEntries
} from '../../telegram-read-model/directory.js';
import { andSql } from '../../telegram-read-model/sql.js';

export const listChatDirectory = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramListChatDirectoryInputSchema)
    .output(telegramListChatDirectoryOutputSchema)
    .query(({ input }) => runListChatDirectory(runtime, input))
);

async function runListChatDirectory(
  { database }: TelegramProcedureContext,
  input: TelegramListChatDirectoryInput
): Promise<TelegramListChatDirectoryOutput> {
  const searchQuery = input.query?.trim();
  const type = input.type?.trim();
  const queryWhere =
    searchQuery === undefined || searchQuery.length === 0
      ? undefined
      : chatSearchWhere(searchQuery);
  const typeWhere =
    type === undefined
      ? undefined
      : sql`${telegramChats.type}->>'_' = ${chatTypeToTdlibConstructor(type)}`;
  const where = andSql(queryWhere, typeWhere);
  const navigationWhere = typeWhere;

  const [matchingChats, navigationChats, folders] = await Promise.all([
    database
      .select(readChatSelection())
      .from(telegramChats)
      .where(where)
      .orderBy(asc(telegramChats.title), asc(telegramChats.id)),
    database
      .select(readChatSelection())
      .from(telegramChats)
      .where(navigationWhere)
      .orderBy(asc(telegramChats.title), asc(telegramChats.id)),
    database
      .select({
        icon: telegramChatFolderInfos.icon,
        id: telegramChatFolderInfos.id,
        name: telegramChatFolderInfos.name,
        position: telegramChatFolderInfos.position
      })
      .from(telegramChatFolderInfos)
      .orderBy(asc(telegramChatFolderInfos.position), asc(telegramChatFolderInfos.id))
  ]);
  const chatEntries = listableDirectoryEntries(
    await toDirectoryEntries(database, matchingChats.map(toTelegramChatStorageRow))
  );
  const navigationEntries = listableDirectoryEntries(
    await toDirectoryEntries(database, navigationChats.map(toTelegramChatStorageRow))
  );
  const folderEntries: TelegramChatFolder[] = folders.map(chatFolderEntry);

  return {
    chats: chatEntries,
    folders: folderEntries,
    navigationChats: navigationEntries,
    types: chatTypeCounts(navigationEntries)
  };
}

function chatTypeToTdlibConstructor(type: string): string {
  if (type === 'private') {
    return 'chatTypePrivate';
  }
  if (type === 'secret') {
    return 'chatTypeSecret';
  }
  if (type === 'channel' || type === 'group') {
    return 'chatTypeSupergroup';
  }
  return type;
}
