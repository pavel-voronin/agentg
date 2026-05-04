import type { SqliteMigration } from '../storage/migrations/types.js';

export const historyBackfillMigration: SqliteMigration = {
  id: '0008',
  name: 'history_backfill_jobs',
  up(database): void {
    const columns = database.prepare('PRAGMA table_info(history_jobs)').all() as {
      name: string;
    }[];
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('cursor_json')) {
      database.exec('ALTER TABLE history_jobs ADD COLUMN cursor_json TEXT');
    }

    if (!columnNames.has('updated_at')) {
      database.exec('ALTER TABLE history_jobs ADD COLUMN updated_at TEXT');
      database
        .prepare(
          `
            UPDATE history_jobs
            SET updated_at = created_at
            WHERE updated_at IS NULL
          `
        )
        .run();
    }
  }
};
