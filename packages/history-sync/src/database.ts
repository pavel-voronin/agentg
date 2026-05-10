import { createAppDatabase, type AppDatabase } from '@agentg/database/client';
import type { Pool } from 'pg';

import * as schema from './schema.js';

export type HistorySyncDatabase = AppDatabase<typeof schema>;

export function createHistorySyncDatabase(pool: Pool): HistorySyncDatabase {
  return createAppDatabase(pool, schema);
}
