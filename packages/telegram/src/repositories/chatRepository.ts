import { asc, inArray, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramChatPositions, telegramChats } from '../database/schema.js';
import type { Chat } from '../domain/models/chat.js';
import type { ChatPlacement } from '../domain/models/chatPlacement.js';
import type {
  ChatListMembership,
  ChatPositionState,
  ChatState,
  ChatPatch
} from '../domain/models/chatState.js';
import type { FileRef } from '../domain/models/fileRef.js';
import { readChatPlacementsByChat } from '../storage/chatDirectoryStorage.js';
import { readFileRefsForOwners } from '../storage/fileReadStorage.js';
import { readChatRowById, readChatSelection, toChatStorageRow } from '../storage/chatRowStorage.js';
import {
  addChatListMembership,
  deleteChatPositionState,
  removeChatListMembership,
  replaceChatPositionStates,
  saveChatState,
  upsertChatPositionState,
  upsertChatPatch
} from '../storage/chatStorage.js';
import { andSql } from '../storage/sqlCondition.js';

export type ChatRepository = {
  addListMembership(membership: ChatListMembership): Promise<void>;
  deletePosition(input: { chatId: string; listKey: string }): Promise<void>;
  list(input?: ChatListRead): Promise<readonly ChatListItem[]>;
  read(chatId: string): Promise<Chat | null>;
  removeListMembership(membership: Omit<ChatListMembership, 'chatList'>): Promise<void>;
  replacePositions(chatId: string, positions: readonly ChatPositionState[]): Promise<void>;
  save(chat: ChatState, positions: readonly ChatPositionState[]): Promise<void>;
  transaction<T>(operation: (repository: ChatRepository) => Promise<T>): Promise<T>;
  upsert(chat: ChatPatch): Promise<void>;
  upsertPosition(position: ChatPositionState): Promise<void>;
};

export type ChatListRead = {
  chatIds?: readonly string[] | undefined;
  folderId?: number | undefined;
  limit?: number | undefined;
  pinned?: boolean | undefined;
  readState?: 'read' | 'unread' | undefined;
  type?: string | undefined;
};

export type ChatListItem = {
  chat: Chat;
  isMarkedAsUnread: boolean | null;
  lastReadInboxMessageId: string | null;
  placements: readonly ChatPlacement[];
  unreadCount: number | null;
};

export function createChatRepository(database: Database): ChatRepository {
  return {
    addListMembership(membership) {
      return addChatListMembership(database, membership);
    },
    deletePosition(input) {
      return deleteChatPositionState(database, input);
    },
    async list(input = {}) {
      if (input.chatIds?.length === 0) {
        return [];
      }
      const query = database
        .select(readChatSelection())
        .from(telegramChats)
        .where(chatListWhere(input))
        .orderBy(asc(telegramChats.title), asc(telegramChats.id));
      const rows = input.limit === undefined ? await query : await query.limit(input.limit);
      const chatRows = rows.map(toChatStorageRow);
      const placementsByChat = await readChatPlacementsByChat(database, chatRows);
      const filesByChat = await readChatFileRefsByChat(
        database,
        chatRows.map((row) => row.telegramChatId)
      );
      return chatRows.map((row) => ({
        chat: toChat(row, filesByChat.get(row.telegramChatId) ?? []),
        isMarkedAsUnread: row.isMarkedAsUnread,
        lastReadInboxMessageId: row.lastReadInboxMessageId,
        placements: placementsByChat.get(row.telegramChatId) ?? [],
        unreadCount: row.unreadCount
      }));
    },
    async read(chatId) {
      const row = await readChatRowById(database, chatId);
      if (row === undefined) {
        return null;
      }
      const filesByChat = await readChatFileRefsByChat(database, [row.telegramChatId]);
      return toChat(row, filesByChat.get(row.telegramChatId) ?? []);
    },
    removeListMembership(membership) {
      return removeChatListMembership(database, membership);
    },
    replacePositions(chatId, positions) {
      return replaceChatPositionStates(database, chatId, positions);
    },
    save(chat, positions) {
      return saveChatState(database, chat, positions);
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createChatRepository(transaction)));
    },
    upsert(chat) {
      return upsertChatPatch(database, chat);
    },
    upsertPosition(position) {
      return upsertChatPositionState(database, position);
    }
  };
}

function chatListWhere(input: ChatListRead): SQL | undefined {
  return andSql(
    input.chatIds === undefined ? undefined : inArray(telegramChats.id, [...input.chatIds]),
    input.type === undefined ? undefined : chatTypeWhere(input.type),
    input.readState === undefined ? undefined : readStateWhere(input.readState),
    input.folderId === undefined ? undefined : folderWhere(input.folderId),
    input.pinned === undefined ? undefined : pinnedWhere(input.pinned)
  );
}

function chatTypeWhere(type: string): SQL {
  switch (type) {
    case 'private':
      return sql`${telegramChats.type}->>'_' = 'chatTypePrivate'`;
    case 'secret':
      return sql`${telegramChats.type}->>'_' = 'chatTypeSecret'`;
    case 'group':
      return sql`(${telegramChats.type}->>'_' = 'chatTypeBasicGroup' or (${telegramChats.type}->>'_' = 'chatTypeSupergroup' and coalesce((${telegramChats.type}->>'is_channel')::boolean, false) = false))`;
    case 'channel':
      return sql`${telegramChats.type}->>'_' = 'chatTypeSupergroup' and coalesce((${telegramChats.type}->>'is_channel')::boolean, false) = true`;
    default:
      return sql`coalesce(${telegramChats.type}->>'_', 'unknown') = ${type}`;
  }
}

function readStateWhere(readState: NonNullable<ChatListRead['readState']>): SQL {
  if (readState === 'unread') {
    return sql`(coalesce(${telegramChats.isMarkedAsUnread}, false) = true or coalesce(${telegramChats.unreadCount}, 0) > 0)`;
  }
  return sql`coalesce(${telegramChats.isMarkedAsUnread}, false) = false and coalesce(${telegramChats.unreadCount}, 0) = 0`;
}

function folderWhere(folderId: number): SQL {
  return sql`exists (
    select 1
    from ${telegramChatPositions}
    where ${telegramChatPositions.chatId} = ${telegramChats.id}
      and ${telegramChatPositions.listKey} = ${`folder:${String(folderId)}`}
  )`;
}

function pinnedWhere(pinned: boolean): SQL {
  return sql`exists (
    select 1
    from ${telegramChatPositions}
    where ${telegramChatPositions.chatId} = ${telegramChats.id}
      and ${telegramChatPositions.isPinned} = ${pinned}
  )`;
}

async function readChatFileRefsByChat(
  database: Database,
  chatIds: readonly string[]
): Promise<Map<string, FileRef[]>> {
  const refs = await readFileRefsForOwners(
    database,
    chatIds.map((chatId) => ({
      ownerId: chatId,
      ownerModel: 'telegram.chat'
    }))
  );
  const output = new Map<string, FileRef[]>();
  for (const chatId of chatIds) {
    output.set(chatId, refs.get(`telegram.chat:${chatId}`) ?? []);
  }
  return output;
}

function toChat(row: Awaited<ReturnType<typeof readChatRowById>>, files: FileRef[]): Chat {
  if (row === undefined) {
    throw new Error('chat row is required');
  }
  return {
    _model: 'telegram.chat',
    avatar: {
      big: files.find((file) => file.slotKey === 'avatar.big') ?? null,
      small: files.find((file) => file.slotKey === 'avatar.small') ?? null
    },
    id: row.telegramChatId,
    title: row.title,
    type: row.type,
    updatedAt: new Date(0).toISOString()
  };
}
