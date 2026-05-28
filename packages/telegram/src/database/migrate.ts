import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runDrizzleMigrations } from '@agentg/database/migrate';

import type { TelegramDatabase } from './client.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export async function runTelegramMigrations(database: TelegramDatabase): Promise<void> {
  await runDrizzleMigrations(database, {
    migrationsFolder: resolve(packageRoot, 'drizzle'),
    migrationsTable: '__drizzle_migrations_telegram'
  });
}
