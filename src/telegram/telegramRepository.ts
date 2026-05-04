import type { Database } from 'better-sqlite3';

import type {
  NormalizedTelegramChat,
  NormalizedTelegramChatList,
  NormalizedTelegramChatListUpdate,
  NormalizedTelegramChatFolders,
  NormalizedTelegramMessage,
  NormalizedTelegramMessageContentUpdate,
  NormalizedTelegramMessageDelete,
  NormalizedTelegramUpdate,
  NormalizedTelegramUser,
  RawTelegramEvent
} from './normalize.js';

export type TelegramRepository = {
  countChats(input?: TelegramChatCountInput): number;
  getChat(chatId: string): TelegramChatDto | undefined;
  getMessage(chatId: string, messageId: string): TelegramMessageDto | undefined;
  listChatFolders(): TelegramChatFolderDto[];
  listChatTypeCounts(): TelegramChatTypeCountDto[];
  listChats(input?: TelegramChatListInput): TelegramChatDto[];
  listRecentMessages(input?: TelegramRecentMessagesInput): TelegramMessageDto[];
  persistCurrentUser(user: NormalizedTelegramUser): boolean;
  persistUpdate(update: NormalizedTelegramUpdate): TelegramPersistResult;
  searchMessages(input: TelegramSearchMessagesInput): TelegramMessageDto[];
};

export type TelegramPersistResult = {
  chat: boolean;
  chatFolders: boolean;
  chatList: boolean;
  event: boolean;
  message: boolean;
  user: boolean;
};

export type TelegramChatDto = {
  id: string;
  title: string;
  type: string;
  updatedAt: string;
};

export type TelegramChatFolderDto = {
  count: number;
  iconName: string | null;
  id: number;
  position: number;
  title: string;
};

export type TelegramChatListInput = {
  folderId?: number | null;
  limit?: number;
  list?: 'archive' | 'folder' | 'main';
  query?: string;
};

export type TelegramChatCountInput = Pick<TelegramChatListInput, 'folderId' | 'list'>;

export type TelegramChatTypeCountDto = {
  count: number;
  type: string;
};

export type TelegramRecentMessagesInput = {
  chatId?: string;
  limit?: number;
};

export type TelegramSearchMessagesInput = {
  query: string;
  chatId?: string;
  limit?: number;
};

export type TelegramMessageDto = {
  chatId: string;
  contentType: string;
  isDeleted: boolean;
  messageId: string;
  updatedAt: string;
  editDate?: string;
  messageDate?: string;
  senderId?: string;
  senderType?: string;
  text?: string;
};

type ChatRow = {
  telegram_chat_id: string;
  title: string;
  type: string;
  updated_at: string;
};

type ChatFolderRow = {
  count: number;
  icon_name: string | null;
  position: number;
  telegram_chat_folder_id: number;
  title: string;
};

type ChatTypeCountRow = {
  count: number;
  type: string;
};

type MessageRow = {
  content_type: string;
  edit_date: string | null;
  is_deleted: 0 | 1;
  message_date: string | null;
  sender_id: string | null;
  sender_type: string | null;
  telegram_chat_id: string;
  telegram_message_id: string;
  text: string | null;
  updated_at: string;
};

export function createTelegramRepository(database: Database): TelegramRepository {
  return {
    countChats(input = {}): number {
      const query = chatListQuery(input);
      const row = database
        .prepare(
          `
            SELECT count(DISTINCT c.telegram_chat_id) AS count
            ${query.from}
            ${query.where}
          `
        )
        .get(...query.params) as {
        count: number;
      };
      return row.count;
    },
    getChat(chatId): TelegramChatDto | undefined {
      const row = database
        .prepare(
          `
            SELECT
              c.telegram_chat_id,
              ${chatDisplayTitleSql()} AS title,
              c.type,
              c.updated_at
            FROM telegram_chats c
            ${chatUserJoinSql()}
            WHERE c.telegram_chat_id = ?
          `
        )
        .get(chatId) as ChatRow | undefined;

      return row === undefined ? undefined : mapChatRow(row);
    },
    getMessage(chatId, messageId): TelegramMessageDto | undefined {
      const row = database
        .prepare(
          `
            SELECT
              telegram_chat_id,
              telegram_message_id,
              sender_id,
              sender_type,
              content_type,
              text,
              message_date,
              edit_date,
              is_deleted,
              updated_at
            FROM telegram_messages
            WHERE telegram_chat_id = ? AND telegram_message_id = ?
          `
        )
        .get(chatId, messageId) as MessageRow | undefined;

      return row === undefined ? undefined : mapMessageRow(row);
    },
    listChatFolders(): TelegramChatFolderDto[] {
      return database
        .prepare(
          `
            SELECT
              f.telegram_chat_folder_id,
              f.position,
              f.title,
              f.icon_name,
              count(m.telegram_chat_id) AS count
            FROM telegram_chat_folders f
            LEFT JOIN telegram_chat_list_memberships m
              ON m.list_type = 'folder'
             AND m.telegram_chat_folder_id = f.telegram_chat_folder_id
            GROUP BY f.telegram_chat_folder_id, f.position, f.title, f.icon_name
            ORDER BY f.position ASC, f.title ASC
          `
        )
        .all()
        .map((row) => mapChatFolderRow(row as ChatFolderRow));
    },
    listChatTypeCounts(): TelegramChatTypeCountDto[] {
      return database
        .prepare(
          `
            SELECT type, count(*) AS count
            FROM telegram_chats
            GROUP BY type
            ORDER BY count DESC, type ASC
          `
        )
        .all()
        .map((row) => {
          const typed = row as ChatTypeCountRow;
          return {
            count: typed.count,
            type: typed.type
          };
        });
    },
    listChats(input = {}): TelegramChatDto[] {
      const limit = normalizeChatListLimit(input.limit);
      const query = input.query?.trim();
      const hasQuery = query !== undefined && query.length > 0;
      const listQuery = chatListQuery(hasQuery ? {} : input);
      const orderBy =
        !hasQuery && input.list !== undefined
          ? `
            ORDER BY
              CASE WHEN m.list_order IS NULL THEN 1 ELSE 0 END ASC,
              length(m.list_order) DESC,
              m.list_order DESC,
              title ASC,
              c.telegram_chat_id ASC
          `
          : `
            ORDER BY
              c.updated_at DESC,
              title ASC,
              c.telegram_chat_id ASC
          `;
      const rows = database
        .prepare(
          `
            SELECT
              c.telegram_chat_id,
              ${chatDisplayTitleSql()} AS title,
              c.type,
              c.updated_at
            ${listQuery.from}
            ${
              hasQuery
                ? `${listQuery.where.length > 0 ? `${listQuery.where} AND` : 'WHERE'} (${chatDisplayTitleSql()} LIKE ? ESCAPE '\\' OR c.telegram_chat_id LIKE ? ESCAPE '\\')`
                : listQuery.where
            }
            ${orderBy}
            LIMIT ?
          `
        )
        .all(
          ...listQuery.params,
          ...(hasQuery ? [likePattern(query), likePattern(query)] : []),
          limit
        );

      return rows.map((row) => mapChatRow(row as ChatRow));
    },
    listRecentMessages(input = {}): TelegramMessageDto[] {
      const limit = normalizeMessageListLimit(input.limit, 50, 200);
      const rows =
        input.chatId === undefined
          ? database
              .prepare(
                `
                  SELECT
                    telegram_chat_id,
                    telegram_message_id,
                    sender_id,
                    sender_type,
                    content_type,
                    text,
                    message_date,
                    edit_date,
                    is_deleted,
                    updated_at
                  FROM telegram_messages
                  ORDER BY message_date DESC, CAST(telegram_message_id AS INTEGER) DESC
                  LIMIT ?
                `
              )
              .all(limit)
          : database
              .prepare(
                `
                  SELECT
                    telegram_chat_id,
                    telegram_message_id,
                    sender_id,
                    sender_type,
                    content_type,
                    text,
                    message_date,
                    edit_date,
                    is_deleted,
                    updated_at
                  FROM telegram_messages
                  WHERE telegram_chat_id = ?
                  ORDER BY message_date DESC, CAST(telegram_message_id AS INTEGER) DESC
                  LIMIT ?
                `
              )
              .all(input.chatId, limit);

      return rows.map((row) => mapMessageRow(row as MessageRow));
    },
    persistCurrentUser(user): boolean {
      const transaction = database.transaction(() => {
        database
          .prepare(
            `
              UPDATE telegram_users
              SET is_self = 0,
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              WHERE is_self = 1 AND telegram_user_id <> ?
            `
          )
          .run(user.id);

        return upsertUser(database, {
          ...user,
          isSelf: true
        });
      });

      return transaction();
    },
    persistUpdate(update): TelegramPersistResult {
      const transaction = database.transaction(() => {
        const chat = update.chat === undefined ? false : upsertChat(database, update.chat);
        const chatListsFromChat =
          update.chat === undefined ? false : replaceChatListMemberships(database, update.chat);
        const chatListUpdate =
          update.chatList === undefined ? false : applyChatListUpdate(database, update.chatList);

        return {
          chat,
          chatFolders:
            update.chatFolders === undefined
              ? false
              : replaceChatFolders(database, update.chatFolders),
          chatList: chatListsFromChat || chatListUpdate,
          event: update.event === undefined ? false : insertRawEvent(database, update.event),
          message: persistMessageChange(database, update),
          user: update.user === undefined ? false : upsertUser(database, update.user)
        };
      });

      return transaction();
    },
    searchMessages(input): TelegramMessageDto[] {
      const query = input.query.trim();
      if (query.length === 0) {
        throw new Error('Telegram message search query must not be empty');
      }

      const limit = normalizeMessageListLimit(input.limit, 20, 100);
      const rows =
        input.chatId === undefined
          ? database
              .prepare(
                `
                  SELECT
                    telegram_chat_id,
                    telegram_message_id,
                    sender_id,
                    sender_type,
                    content_type,
                    text,
                    message_date,
                    edit_date,
                    is_deleted,
                    updated_at
                  FROM telegram_messages
                  WHERE text LIKE ? ESCAPE '\\'
                  ORDER BY message_date DESC, CAST(telegram_message_id AS INTEGER) DESC
                  LIMIT ?
                `
              )
              .all(likePattern(query), limit)
          : database
              .prepare(
                `
                  SELECT
                    telegram_chat_id,
                    telegram_message_id,
                    sender_id,
                    sender_type,
                    content_type,
                    text,
                    message_date,
                    edit_date,
                    is_deleted,
                    updated_at
                  FROM telegram_messages
                  WHERE telegram_chat_id = ?
                    AND text LIKE ? ESCAPE '\\'
                  ORDER BY message_date DESC, CAST(telegram_message_id AS INTEGER) DESC
                  LIMIT ?
                `
              )
              .all(input.chatId, likePattern(query), limit);

      return rows.map((row) => mapMessageRow(row as MessageRow));
    }
  };
}

function upsertChat(database: Database, chat: NormalizedTelegramChat): boolean {
  const existing = database
    .prepare(
      `
        SELECT title, type
        FROM telegram_chats
        WHERE telegram_chat_id = ?
      `
    )
    .get(chat.id) as Pick<ChatRow, 'title' | 'type'> | undefined;

  const result = database
    .prepare(
      `
        INSERT INTO telegram_chats (telegram_chat_id, title, type, raw_json)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (telegram_chat_id) DO UPDATE SET
          title = excluded.title,
          type = excluded.type,
          raw_json = excluded.raw_json,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    )
    .run(chat.id, chat.title, chat.type, JSON.stringify(chat.raw));

  const materiallyChanged =
    existing === undefined ? true : existing.title !== chat.title || existing.type !== chat.type;

  return result.changes > 0 && materiallyChanged;
}

function upsertUser(database: Database, user: NormalizedTelegramUser): boolean {
  const result = database
    .prepare(
      `
        INSERT INTO telegram_users (
          telegram_user_id,
          first_name,
          last_name,
          username,
          is_bot,
          is_self,
          raw_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (telegram_user_id) DO UPDATE SET
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          username = excluded.username,
          is_bot = excluded.is_bot,
          is_self = excluded.is_self,
          raw_json = excluded.raw_json,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    )
    .run(
      user.id,
      user.firstName,
      user.lastName,
      user.username ?? null,
      user.isBot ? 1 : 0,
      user.isSelf === true ? 1 : 0,
      JSON.stringify(user.raw)
    );

  return result.changes > 0;
}

function replaceChatFolders(database: Database, update: NormalizedTelegramChatFolders): boolean {
  const folderIds = update.folders.map((folder) => folder.id);

  if (folderIds.length === 0) {
    database.prepare('DELETE FROM telegram_chat_folders').run();
    return true;
  }

  const placeholders = folderIds.map(() => '?').join(', ');
  database
    .prepare(
      `
        DELETE FROM telegram_chat_folders
        WHERE telegram_chat_folder_id NOT IN (${placeholders})
      `
    )
    .run(...folderIds);

  const statement = database.prepare(
    `
      INSERT INTO telegram_chat_folders (
        telegram_chat_folder_id,
        position,
        title,
        icon_name,
        raw_json
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (telegram_chat_folder_id) DO UPDATE SET
        position = excluded.position,
        title = excluded.title,
        icon_name = excluded.icon_name,
        raw_json = excluded.raw_json,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `
  );

  for (const folder of update.folders) {
    statement.run(
      folder.id,
      folder.position,
      folder.title,
      folder.iconName ?? null,
      JSON.stringify(folder.raw)
    );
  }

  return true;
}

function replaceChatListMemberships(database: Database, chat: NormalizedTelegramChat): boolean {
  if (chat.lists.length === 0) {
    return false;
  }

  database
    .prepare(
      `
        DELETE FROM telegram_chat_list_memberships
        WHERE telegram_chat_id = ?
      `
    )
    .run(chat.id);

  for (const list of chat.lists) {
    insertChatListMembership(database, chat.id, list);
  }

  return true;
}

function applyChatListUpdate(
  database: Database,
  update: NormalizedTelegramChatListUpdate
): boolean {
  if (update.action === 'remove') {
    const result = database
      .prepare(
        `
          DELETE FROM telegram_chat_list_memberships
          WHERE telegram_chat_id = ?
            AND list_type = ?
            AND telegram_chat_folder_id = ?
        `
      )
      .run(update.chatId, update.list.type, chatListFolderId(update.list));

    return result.changes > 0;
  }

  return insertChatListMembership(database, update.chatId, update.list);
}

function insertChatListMembership(
  database: Database,
  chatId: string,
  list: NormalizedTelegramChatList
): boolean {
  const result = database
    .prepare(
      `
        INSERT INTO telegram_chat_list_memberships (
          telegram_chat_id,
          list_type,
          telegram_chat_folder_id,
          list_order
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT (telegram_chat_id, list_type, telegram_chat_folder_id) DO UPDATE SET
          list_order = coalesce(
            excluded.list_order,
            telegram_chat_list_memberships.list_order
          ),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    )
    .run(chatId, list.type, chatListFolderId(list), list.order ?? null);

  return result.changes > 0;
}

function chatListFolderId(list: NormalizedTelegramChatList): number {
  return list.type === 'folder' ? (list.folderId ?? 0) : 0;
}

function insertRawEvent(database: Database, event: RawTelegramEvent): boolean {
  const result = database
    .prepare(
      `
        INSERT OR IGNORE INTO telegram_events (
          event_key,
          event_type,
          occurred_at,
          payload_json,
          payload_hash,
          tdlib_update_type,
          telegram_chat_id,
          telegram_message_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      event.eventKey,
      event.eventType,
      event.occurredAt?.toISOString() ?? null,
      JSON.stringify(event.payload),
      event.payloadHash,
      event.tdlibUpdateType,
      event.telegramChatId ?? null,
      event.telegramMessageId ?? null
    );

  return result.changes === 1;
}

function persistMessageChange(database: Database, update: NormalizedTelegramUpdate): boolean {
  if (update.message !== undefined) {
    return upsertMessage(database, update.message);
  }
  if (update.contentUpdate !== undefined) {
    return updateMessageContent(database, update.contentUpdate);
  }
  if (update.delete !== undefined) {
    return markMessagesDeleted(database, update.delete);
  }

  return false;
}

function upsertMessage(database: Database, message: NormalizedTelegramMessage): boolean {
  const result = database
    .prepare(
      `
        INSERT INTO telegram_messages (
          telegram_chat_id,
          telegram_message_id,
          sender_id,
          sender_type,
          content_type,
          text,
          message_date,
          edit_date,
          is_deleted,
          raw_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        ON CONFLICT (telegram_chat_id, telegram_message_id) DO UPDATE SET
          sender_id = excluded.sender_id,
          sender_type = excluded.sender_type,
          content_type = excluded.content_type,
          text = excluded.text,
          message_date = excluded.message_date,
          edit_date = excluded.edit_date,
          is_deleted = 0,
          deleted_at = NULL,
          raw_json = excluded.raw_json,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    )
    .run(
      message.chatId,
      message.messageId,
      message.senderId ?? null,
      message.senderType ?? null,
      message.contentType,
      message.text ?? null,
      message.messageDate?.toISOString() ?? null,
      message.editDate?.toISOString() ?? null,
      JSON.stringify(message.raw)
    );

  return result.changes > 0;
}

function updateMessageContent(
  database: Database,
  update: NormalizedTelegramMessageContentUpdate
): boolean {
  const result = database
    .prepare(
      `
        UPDATE telegram_messages
        SET content_type = ?,
            text = ?,
            edit_date = ?,
            is_deleted = 0,
            deleted_at = NULL,
            raw_json = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE telegram_chat_id = ? AND telegram_message_id = ?
      `
    )
    .run(
      update.contentType,
      update.text ?? null,
      update.editDate?.toISOString() ?? null,
      JSON.stringify(update.raw),
      update.chatId,
      update.messageId
    );

  return result.changes === 1;
}

function markMessagesDeleted(database: Database, update: NormalizedTelegramMessageDelete): boolean {
  if (update.fromCache || !update.isPermanent) {
    return false;
  }

  const placeholders = update.messageIds.map(() => '?').join(', ');
  const result = database
    .prepare(
      `
        UPDATE telegram_messages
        SET is_deleted = 1,
            deleted_at = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE telegram_chat_id = ? AND telegram_message_id IN (${placeholders})
      `
    )
    .run(update.deletedAt.toISOString(), update.chatId, ...update.messageIds);

  return result.changes > 0;
}

function mapChatRow(row: ChatRow): TelegramChatDto {
  return {
    id: row.telegram_chat_id,
    title: row.title,
    type: row.type,
    updatedAt: row.updated_at
  };
}

function mapChatFolderRow(row: ChatFolderRow): TelegramChatFolderDto {
  return {
    count: row.count,
    iconName: row.icon_name,
    id: row.telegram_chat_folder_id,
    position: row.position,
    title: row.title
  };
}

function mapMessageRow(row: MessageRow): TelegramMessageDto {
  return {
    chatId: row.telegram_chat_id,
    contentType: row.content_type,
    isDeleted: row.is_deleted === 1,
    messageId: row.telegram_message_id,
    updatedAt: row.updated_at,
    ...(row.edit_date === null ? {} : { editDate: row.edit_date }),
    ...(row.message_date === null ? {} : { messageDate: row.message_date }),
    ...(row.sender_id === null ? {} : { senderId: row.sender_id }),
    ...(row.sender_type === null ? {} : { senderType: row.sender_type }),
    ...(row.text === null ? {} : { text: row.text })
  };
}

function chatListQuery(input: TelegramChatCountInput): {
  from: string;
  params: unknown[];
  where: string;
} {
  if (input.list === undefined) {
    return {
      from: `FROM telegram_chats c ${chatUserJoinSql()}`,
      params: [],
      where: ''
    };
  }

  if (input.list === 'folder' && input.folderId === undefined) {
    return {
      from: `FROM telegram_chats c ${chatUserJoinSql()}`,
      params: [],
      where: 'WHERE 1 = 0'
    };
  }

  return {
    from: `
      FROM telegram_chats c
      ${chatUserJoinSql()}
      JOIN telegram_chat_list_memberships m
        ON m.telegram_chat_id = c.telegram_chat_id
    `,
    params: input.list === 'folder' ? [input.list, input.folderId ?? null] : [input.list],
    where:
      input.list === 'folder'
        ? 'WHERE m.list_type = ? AND m.telegram_chat_folder_id = ?'
        : 'WHERE m.list_type = ?'
  };
}

function normalizeChatListLimit(value: number | undefined): number {
  if (value === undefined) {
    return 500;
  }

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Telegram chat list limit must be a positive safe integer');
  }

  return Math.min(value, 2000);
}

function normalizeMessageListLimit(
  value: number | undefined,
  fallback: number,
  max: number
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Telegram message list limit must be a positive safe integer');
  }

  return Math.min(value, max);
}

function chatDisplayTitleSql(): string {
  const fullName = "trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))";

  return `
    CASE
      WHEN trim(c.title) <> '' THEN c.title
      WHEN u.is_self = 1 THEN 'Saved Messages'
      WHEN ${fullName} <> '' THEN ${fullName}
      WHEN trim(coalesce(u.username, '')) <> '' THEN u.username
      WHEN json_extract(u.raw_json, '$.type._') = 'userTypeDeleted' THEN 'Deleted Account'
      WHEN c.type = 'private' THEN 'Unknown User'
      ELSE c.telegram_chat_id
    END
  `;
}

function chatUserJoinSql(): string {
  return `
    LEFT JOIN telegram_users u
      ON u.telegram_user_id = CAST(json_extract(c.raw_json, '$.type.user_id') AS TEXT)
  `;
}

function likePattern(value: string): string {
  return `%${value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
}
