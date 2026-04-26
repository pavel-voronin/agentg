import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import type { AppDatabase } from './client.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function runDatabaseMigrations(database: AppDatabase): Promise<void> {
  await migrate(database, {
    migrationsFolder: resolve(packageRoot, 'drizzle')
  });
}
