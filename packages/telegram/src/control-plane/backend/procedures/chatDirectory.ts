import { query } from '@agentg/rpc/surface';
import { chatDirectoryInputSchema, chatDirectoryOutputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../../../rpc/runtime.js';
import { rpc } from '../../../rpc/trpc.js';
import { asc, sql } from 'drizzle-orm';
import type { ChatDirectoryInput, ChatDirectoryOutput, ChatFolder } from '../contracts.js';
import { telegramChatFolderInfos, telegramChats } from '../../../schema.js';
import type { TelegramProcedureContext } from '../../../procedure-runtime/context.js';
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

export const chatDirectory = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(chatDirectoryInputSchema)
    .output(chatDirectoryOutputSchema)
    .query(({ input }) => runChatDirectory(runtime, input))
);

async function runChatDirectory(
  { database }: TelegramProcedureContext,
  input: ChatDirectoryInput
): Promise<ChatDirectoryOutput> {
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
