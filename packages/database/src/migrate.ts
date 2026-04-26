import { migrate } from 'drizzle-orm/node-postgres/migrator';

import type { AppDatabase } from './client.js';

export async function runDatabaseMigrations(database: AppDatabase): Promise<void> {
  await migrate(database, {
    migrationsFolder: 'drizzle'
  });
}
