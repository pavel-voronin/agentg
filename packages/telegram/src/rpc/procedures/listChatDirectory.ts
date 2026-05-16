import { query } from '@agentg/rpc/surface';
import { telegramChatFolderRef } from '@agentg/telegram/model-refs';
import { asc, sql } from 'drizzle-orm';

import {
  telegramListChatDirectoryInputSchema,
  telegramListChatDirectoryOutputSchema,
  type TelegramChatFolder
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { telegramChatFolderInfos, telegramChats } from '../../schema.js';
import {
  andSql,
  chatSearchWhere,
  chatTypeCounts,
  listableDirectoryEntries,
  readChatSelection,
  toDirectoryEntries,
  toTelegramChatStorageRow
} from './support.js';

export const listChatDirectory = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramListChatDirectoryInputSchema)
    .output(telegramListChatDirectoryOutputSchema)
    .query(async ({ input }) => {
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
        runtime.database
          .select(readChatSelection())
          .from(telegramChats)
          .where(where)
          .orderBy(asc(telegramChats.title), asc(telegramChats.id)),
        runtime.database
          .select(readChatSelection())
          .from(telegramChats)
          .where(navigationWhere)
          .orderBy(asc(telegramChats.title), asc(telegramChats.id)),
        runtime.database
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
        await toDirectoryEntries(runtime.database, matchingChats.map(toTelegramChatStorageRow))
      );
      const navigationEntries = listableDirectoryEntries(
        await toDirectoryEntries(runtime.database, navigationChats.map(toTelegramChatStorageRow))
      );
      const folderEntries = folders.map(chatFolderEntry);

      return {
        chats: chatEntries,
        folders: folderEntries,
        navigationChats: navigationEntries,
        types: chatTypeCounts(navigationEntries)
      };
    })
);

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

function chatFolderEntry(folder: {
  icon: unknown;
  id: number;
  name: unknown;
  position: number;
}): TelegramChatFolder {
  return {
    ...telegramChatFolderRef(folder.id),
    folderId: folder.id,
    iconName: chatFolderIconName(folder.icon),
    position: folder.position,
    title: chatFolderTitle(folder)
  };
}

function chatFolderTitle(folder: { id: number; name: unknown }): string {
  const name = plainRecord(folder.name);
  const text = plainRecord(name?.text);
  return typeof text?.text === 'string' ? text.text : `Folder ${String(folder.id)}`;
}

function chatFolderIconName(value: unknown): string | null {
  const icon = plainRecord(value);
  return typeof icon?.name === 'string' ? icon.name : null;
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
