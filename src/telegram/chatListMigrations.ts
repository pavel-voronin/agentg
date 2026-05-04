import type { SqliteMigration } from '../storage/migrations/types.js';

type ChatList = {
  type: 'archive' | 'folder' | 'main';
  folderId?: number;
};

type TdObject = {
  _: string;
  [key: string]: unknown;
};

export const telegramChatListMembershipsMigration: SqliteMigration = {
  id: '0007',
  name: 'telegram_chat_list_memberships',
  up(database): void {
    database.exec(`
      CREATE TABLE telegram_chat_list_memberships (
        telegram_chat_id TEXT NOT NULL,
        list_type TEXT NOT NULL,
        telegram_chat_folder_id INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (telegram_chat_id, list_type, telegram_chat_folder_id)
      );

      CREATE INDEX telegram_chat_list_memberships_list_idx
        ON telegram_chat_list_memberships (list_type, telegram_chat_folder_id);
    `);

    backfillChatListMemberships(database);
  }
};

function backfillChatListMemberships(database: {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): unknown;
  };
}): void {
  const chatRows = database
    .prepare(
      `
        SELECT telegram_chat_id, raw_json
        FROM telegram_chats
      `
    )
    .all() as { raw_json: string; telegram_chat_id: string }[];

  for (const row of chatRows) {
    for (const list of chatListsFromChat(readJsonObject(row.raw_json))) {
      insertMembership(database, row.telegram_chat_id, list);
    }
  }

  const eventRows = database
    .prepare(
      `
        SELECT tdlib_update_type, payload_json
        FROM telegram_events
        WHERE tdlib_update_type IN (
          'updateChatAddedToList',
          'updateChatRemovedFromList',
          'updateChatPosition'
        )
        ORDER BY id ASC
      `
    )
    .all() as { payload_json: string; tdlib_update_type: string }[];

  for (const row of eventRows) {
    const event = readJsonObject(row.payload_json);
    if (event === undefined) {
      continue;
    }

    const chatId = stringifyTelegramId(event.chat_id);
    const list =
      row.tdlib_update_type === 'updateChatPosition'
        ? chatListFromPosition(asTdObject(event.position))
        : chatListFromValue(event.chat_list);
    if (chatId === undefined || list === undefined) {
      continue;
    }

    const remove =
      row.tdlib_update_type === 'updateChatRemovedFromList' ||
      (row.tdlib_update_type === 'updateChatPosition' && asTdObject(event.position)?.order === 0);

    if (remove) {
      deleteMembership(database, chatId, list);
    } else {
      insertMembership(database, chatId, list);
    }
  }
}

function insertMembership(
  database: {
    prepare(sql: string): {
      run(...params: unknown[]): unknown;
    };
  },
  chatId: string,
  list: ChatList
): void {
  database
    .prepare(
      `
        INSERT OR IGNORE INTO telegram_chat_list_memberships (
          telegram_chat_id,
          list_type,
          telegram_chat_folder_id
        )
        VALUES (?, ?, ?)
      `
    )
    .run(chatId, list.type, chatListFolderId(list));
}

function deleteMembership(
  database: {
    prepare(sql: string): {
      run(...params: unknown[]): unknown;
    };
  },
  chatId: string,
  list: ChatList
): void {
  database
    .prepare(
      `
        DELETE FROM telegram_chat_list_memberships
        WHERE telegram_chat_id = ?
          AND list_type = ?
          AND telegram_chat_folder_id = ?
      `
    )
    .run(chatId, list.type, chatListFolderId(list));
}

function chatListsFromChat(chat: Record<string, unknown> | undefined): ChatList[] {
  if (chat === undefined) {
    return [];
  }

  const lists = new Map<string, ChatList>();
  const rawChatLists = Array.isArray(chat.chat_lists) ? chat.chat_lists : [];
  const rawPositions = Array.isArray(chat.positions) ? chat.positions : [];

  for (const value of rawChatLists) {
    const list = chatListFromValue(value);
    if (list !== undefined) {
      lists.set(chatListKey(list), list);
    }
  }

  for (const value of rawPositions) {
    const list = chatListFromPosition(asTdObject(value));
    if (list !== undefined) {
      lists.set(chatListKey(list), list);
    }
  }

  return [...lists.values()];
}

function chatListFromPosition(position: TdObject | undefined): ChatList | undefined {
  return chatListFromValue(position?.list);
}

function chatListFromValue(value: unknown): ChatList | undefined {
  const list = asTdObject(value);
  if (list?._ === 'chatListMain') {
    return { type: 'main' };
  }
  if (list?._ === 'chatListArchive') {
    return { type: 'archive' };
  }
  if (list?._ === 'chatListFolder') {
    const folderId = safeInteger(list.chat_folder_id ?? list.chatFolderId);
    return folderId === undefined ? undefined : { folderId, type: 'folder' };
  }

  return undefined;
}

function chatListKey(list: ChatList): string {
  return list.type === 'folder' ? `${list.type}:${String(list.folderId)}` : list.type;
}

function chatListFolderId(list: ChatList): number {
  return list.type === 'folder' ? (list.folderId ?? 0) : 0;
}

function readJsonObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function asTdObject(value: unknown): TdObject | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return typeof record._ === 'string' ? (record as TdObject) : undefined;
}

function stringifyTelegramId(value: unknown): string | undefined {
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }

  return undefined;
}

function safeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}
