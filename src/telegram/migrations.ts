import type { SqliteMigration } from '../storage/migrations/types.js';

export const telegramDomainMigration: SqliteMigration = {
  id: '0002',
  name: 'telegram_domain',
  up(database): void {
    database.exec(`
      CREATE TABLE telegram_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        ingested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        occurred_at TEXT,
        payload_json TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        tdlib_update_type TEXT NOT NULL,
        telegram_chat_id TEXT,
        telegram_message_id TEXT
      );

      CREATE INDEX telegram_events_chat_time_idx
        ON telegram_events (telegram_chat_id, occurred_at);

      CREATE TABLE telegram_chats (
        telegram_chat_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        raw_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE telegram_users (
        telegram_user_id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        username TEXT,
        is_bot INTEGER NOT NULL DEFAULT 0,
        is_self INTEGER NOT NULL DEFAULT 0,
        raw_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE telegram_chat_folders (
        telegram_chat_folder_id INTEGER PRIMARY KEY,
        position INTEGER NOT NULL,
        title TEXT NOT NULL,
        icon_name TEXT,
        raw_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX telegram_chat_folders_position_idx
        ON telegram_chat_folders (position);

      CREATE TABLE telegram_messages (
        telegram_chat_id TEXT NOT NULL,
        telegram_message_id TEXT NOT NULL,
        sender_id TEXT,
        sender_type TEXT,
        content_type TEXT NOT NULL,
        text TEXT,
        message_date TEXT,
        edit_date TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        raw_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (telegram_chat_id, telegram_message_id)
      );

      CREATE INDEX telegram_messages_chat_date_idx
        ON telegram_messages (telegram_chat_id, message_date);

      CREATE TABLE telegram_files (
        file_id TEXT PRIMARY KEY,
        local_path TEXT NOT NULL,
        mime_type TEXT,
        size_bytes INTEGER,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);
  }
};
