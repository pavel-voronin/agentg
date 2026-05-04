import type { SqliteMigration } from '../../storage/migrations/types.js';

export const summariesPluginMigration: SqliteMigration = {
  id: '0004',
  name: 'summaries_plugin',
  up(database): void {
    database.exec(`
      CREATE TABLE summaries_runs (
        id TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT,
        requested_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        failed_at TEXT,
        error_json TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX summaries_runs_chat_status_idx
        ON summaries_runs (telegram_chat_id, status);

      CREATE TABLE summaries_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_chat_id TEXT NOT NULL UNIQUE,
        run_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX summaries_results_chat_idx
        ON summaries_results (telegram_chat_id);

      CREATE TABLE summaries_source_refs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        result_id INTEGER NOT NULL,
        telegram_chat_id TEXT NOT NULL,
        telegram_message_id TEXT NOT NULL,
        message_date TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX summaries_source_refs_result_idx
        ON summaries_source_refs (result_id);

      CREATE INDEX summaries_source_refs_chat_message_idx
        ON summaries_source_refs (telegram_chat_id, telegram_message_id);

      CREATE TABLE summaries_invalidations (
        telegram_chat_id TEXT PRIMARY KEY,
        event_id TEXT,
        invalidated_at TEXT NOT NULL,
        reason TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX summaries_invalidations_reason_idx
        ON summaries_invalidations (reason);
    `);
  }
};
