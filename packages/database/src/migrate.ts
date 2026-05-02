import type { MigrationConfig } from 'drizzle-orm/migrator';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import type { AppDatabase } from './client.js';

export async function runDrizzleMigrations(
  database: AppDatabase<Record<string, unknown>>,
  config: MigrationConfig
): Promise<void> {
  await migrate(database, config);
}
