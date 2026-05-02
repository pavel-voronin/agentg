import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runDrizzleMigrations } from '@agentg/database/migrate';

import type { SummariesDatabase } from './database.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function runSummariesMigrations(database: SummariesDatabase): Promise<void> {
  await runDrizzleMigrations(database, {
    migrationsFolder: resolve(packageRoot, 'drizzle'),
    migrationsTable: '__drizzle_migrations_summaries'
  });
}
