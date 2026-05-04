import type { SqliteMigration } from '../storage/migrations/types.js';

export const historyDomainMigration: SqliteMigration = {
  id: '0003',
  name: 'history_domain',
  up(database): void {
    database.exec(`
      CREATE TABLE history_messages (
        telegram_chat_id TEXT NOT NULL,
        telegram_message_id TEXT NOT NULL,
        content_type TEXT NOT NULL,
        text TEXT,
        message_date TEXT,
        observed_at TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (telegram_chat_id, telegram_message_id)
      );

      CREATE INDEX history_messages_chat_date_idx
        ON history_messages (telegram_chat_id, message_date);

      CREATE TABLE history_coverage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_chat_id TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        source TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX history_coverage_chat_interval_idx
        ON history_coverage (telegram_chat_id, start_at, end_at);

      CREATE TABLE history_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_chat_id TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX history_jobs_status_idx
        ON history_jobs (status, created_at);
    `);
  }
};
