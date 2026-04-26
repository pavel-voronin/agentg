import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

import * as schema from './schema.js';

export type AppDatabase = NodePgDatabase<typeof schema>;

export function createAppDatabase(pool: Pool): AppDatabase {
  return drizzle(pool, { schema });
}
