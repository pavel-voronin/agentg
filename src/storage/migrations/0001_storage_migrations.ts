import { AGENTG_MIGRATIONS_TABLE } from '../schema.js';
import type { SqliteMigration } from './types.js';

export const storageMigrationsMigration: SqliteMigration = {
  id: '0001',
  name: 'storage_migrations',
  up(database): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS ${AGENTG_MIGRATIONS_TABLE} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);
  }
};
