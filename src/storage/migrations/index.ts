import { telegramDomainMigration } from '../../domains/telegram/migrations.js';
import { storageMigrationsMigration } from './0001_storage_migrations.js';
import type { SqliteMigration } from './types.js';

export const sqliteMigrations: readonly SqliteMigration[] = [
  storageMigrationsMigration,
  telegramDomainMigration
];
