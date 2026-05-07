import { query } from '@agentg/rpc/surface';
import { telegramChatFolderRef } from '@agentg/telegram/model-refs';
import { asc, eq } from 'drizzle-orm';

import {
  telegramListChatDirectoryInputSchema,
  telegramListChatDirectoryOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { telegramChatFolders, telegramChats } from '../../schema.js';
import {
  andSql,
  chatSearchWhere,
  chatTypeCounts,
  listableDirectoryEntries,
  toDirectoryEntries
} from './support.js';

export const listChatDirectory = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramListChatDirectoryInputSchema)
    .output(telegramListChatDirectoryOutputSchema)
    .query(async ({ input }) => {
      const rawQuery = input.query?.trim();
      const type = input.type?.trim();
      const queryWhere =
        rawQuery === undefined || rawQuery.length === 0 ? undefined : chatSearchWhere(rawQuery);
      const where = andSql(
        queryWhere,
        type === undefined ? undefined : eq(telegramChats.type, type)
      );
      const navigationWhere = type === undefined ? undefined : eq(telegramChats.type, type);

      const [matchingChats, navigationChats, folders] = await Promise.all([
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
          .orderBy(asc(telegramChatFolders.position), asc(telegramChatFolders.telegramChatFolderId))
      ]);
      const chatEntries = listableDirectoryEntries(
        await toDirectoryEntries(runtime.database, matchingChats)
      );
      const navigationEntries = listableDirectoryEntries(
        await toDirectoryEntries(runtime.database, navigationChats)
      );

      return {
        chats: chatEntries,
        folders: folders.map((folder) => ({
          ...telegramChatFolderRef(folder.telegramChatFolderId),
          folderId: folder.telegramChatFolderId,
          iconName: folder.iconName,
          position: folder.position,
          title: folder.title
        })),
        navigationChats: navigationEntries,
        types: chatTypeCounts(navigationEntries)
      };
    })
);
