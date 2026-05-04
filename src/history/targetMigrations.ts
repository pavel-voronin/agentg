import type { SqliteMigration } from '../storage/migrations/types.js';

export const historyTargetsMigration: SqliteMigration = {
  id: '0005',
  name: 'history_targets',
  up(database): void {
    database.exec(`
      CREATE TABLE history_targets (
        id TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        range_json TEXT NOT NULL,
        template_id TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX history_targets_chat_idx
        ON history_targets (telegram_chat_id);
    `);
  }
};
