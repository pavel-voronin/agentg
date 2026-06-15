import { asc, eq, inArray, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramChatFolderInfos,
  telegramChatPositions,
  telegramChats
} from '../database/schema.js';
import { chatPlacementFromRecord, type ChatPlacement } from '../domain/models/chatPlacement.js';
import type { ChatDirectoryType } from '../domain/models/chatDirectory.js';
import {
  chatSearchWhere,
  readChatSelection,
  toChatStorageRow,
  type ChatStorageRow
} from './chatRowStorage.js';
import { andSql } from './sqlCondition.js';

export type ChatDirectoryFolderRow = {
  iconName: string | null;
  id: number;
  position: number;
  title: string;
};

export type ChatDirectoryRows = {
  folders: ChatDirectoryFolderRow[];
  matchingChats: ChatStorageRow[];
  navigationChats: ChatStorageRow[];
};

export async function readChatDirectoryRows(
  database: Database,
  input: {
    query?: string | undefined;
    type?: ChatDirectoryType | undefined;
  }
): Promise<ChatDirectoryRows> {
  const searchQuery = input.query?.trim();
  const type = input.type;
  const queryWhere =
    searchQuery === undefined || searchQuery.length === 0
      ? undefined
      : chatSearchWhere(searchQuery);
  const typeWhere = type === undefined ? undefined : chatTypeWhere(type);
  const where = andSql(queryWhere, typeWhere);

  const [matchingChats, navigationChats, folders] = await Promise.all([
    database
      .select(readChatSelection())
      .from(telegramChats)
      .where(where)
      .orderBy(asc(telegramChats.title), asc(telegramChats.id)),
    database
      .select(readChatSelection())
      .from(telegramChats)
      .where(typeWhere)
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

  return {
    folders: folders.map(toChatDirectoryFolderRow),
    matchingChats: matchingChats.map(toChatStorageRow),
    navigationChats: navigationChats.map(toChatStorageRow)
  };
}

export async function readChatDirectoryRowById(
  database: Database,
  chatId: string
): Promise<ChatStorageRow | undefined> {
  const [row] = await database
    .select(readChatSelection())
    .from(telegramChats)
    .where(eq(telegramChats.id, chatId))
    .limit(1);
  return row === undefined ? undefined : toChatStorageRow(row);
}

export async function readChatPlacementsByChat(
  database: Database,
  chats: ChatStorageRow[]
): Promise<Map<string, ChatPlacement[]>> {
  const chatIds = chats.map((chat) => chat.telegramChatId).filter((id) => id.length > 0);
  if (chatIds.length === 0) {
    return new Map();
  }

  const rows = await database
    .select({
      chatId: telegramChatPositions.chatId,
      isPinned: telegramChatPositions.isPinned,
      listKey: telegramChatPositions.listKey,
      order: telegramChatPositions.order
    })
    .from(telegramChatPositions)
    .where(inArray(telegramChatPositions.chatId, chatIds));
  const result = new Map<string, ChatPlacement[]>();

  for (const row of rows) {
    const placement = chatPlacementFromRecord(row);
    if (placement === null) {
      continue;
    }
    result.set(row.chatId, [...(result.get(row.chatId) ?? []), placement]);
  }

  return result;
}

function chatTypeWhere(type: ChatDirectoryType): SQL {
  switch (type) {
    case 'private':
      return sql`${telegramChats.type}->>'_' = 'chatTypePrivate'`;
    case 'secret':
      return sql`${telegramChats.type}->>'_' = 'chatTypeSecret'`;
    case 'group':
      return sql`${telegramChats.type}->>'_' = 'chatTypeSupergroup' and ${telegramChats.type}->>'is_channel' = 'false'`;
    case 'channel':
      return sql`${telegramChats.type}->>'_' = 'chatTypeSupergroup' and ${telegramChats.type}->>'is_channel' = 'true'`;
  }
}

function toChatDirectoryFolderRow(row: {
  icon: unknown;
  id: number;
  name: unknown;
  position: number;
}): ChatDirectoryFolderRow {
  return {
    iconName: chatFolderIconName(row.icon),
    id: row.id,
    position: row.position,
    title: chatFolderTitle(row)
  };
}

function chatFolderTitle(folder: { id: number; name: unknown }): string {
  const name = asPlainRecord(folder.name);
  const text = asPlainRecord(name?.text);
  return typeof text?.text === 'string' ? text.text : `Folder ${String(folder.id)}`;
}

function chatFolderIconName(value: unknown): string | null {
  const icon = asPlainRecord(value);
  return typeof icon?.name === 'string' ? icon.name : null;
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
