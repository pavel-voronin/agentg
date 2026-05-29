import { query } from '@agentg/framework/domain';
import { z } from 'zod';

import { useDatabase } from '../../../database/subsystem.js';
import { asc, sql } from 'drizzle-orm';
import { telegramChatFolderInfos, telegramChats } from '../../../database/schema.js';
import {
  chatSearchWhere,
  readChatSelection,
  toTelegramChatStorageRow
} from '../../../read-model/chat.js';
import {
  chatFolderEntry,
  chatTypeCounts,
  listableChatDirectoryEntries,
  toChatDirectoryEntries
} from '../chatDirectory.js';
import { andSql } from '../../../read-model/sql.js';
import { nonEmptyStringSchema } from '../../../read-model/api.js';
import {
  chatDirectoryEntrySchema,
  chatFolderSchema,
  chatTypeCountSchema,
  type ChatFolder
} from '../chatDirectoryModels.js';

export const chatDirectoryInputSchema = z
  .object({
    query: nonEmptyStringSchema.optional(),
    type: nonEmptyStringSchema.optional()
  })
  .default({});

export const chatDirectoryOutputSchema = z.object({
  chats: z.array(chatDirectoryEntrySchema),
  folders: z.array(chatFolderSchema),
  navigationChats: z.array(chatDirectoryEntrySchema),
  types: z.array(chatTypeCountSchema)
});

export type ChatDirectoryInput = z.infer<typeof chatDirectoryInputSchema>;
export type ChatDirectoryOutput = z.infer<typeof chatDirectoryOutputSchema>;

export const chatDirectory = query((_context, procedure) =>
  procedure
    .input(chatDirectoryInputSchema)
    .output(chatDirectoryOutputSchema)
    .query(({ input }) => runChatDirectory(input))
);

async function runChatDirectory(input: ChatDirectoryInput): Promise<ChatDirectoryOutput> {
  const database = useDatabase();
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
  const chatEntries = listableChatDirectoryEntries(
    await toChatDirectoryEntries(database, matchingChats.map(toTelegramChatStorageRow))
  );
  const navigationEntries = listableChatDirectoryEntries(
    await toChatDirectoryEntries(database, navigationChats.map(toTelegramChatStorageRow))
  );
  const folderEntries: ChatFolder[] = folders.map(chatFolderEntry);

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
