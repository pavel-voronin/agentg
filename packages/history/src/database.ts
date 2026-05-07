import { createAppDatabase, type AppDatabase } from '@agentg/database/client';
import type { Pool } from 'pg';

import * as schema from './schema.js';

export type HistoryDatabase = AppDatabase<typeof schema>;

export function createHistoryDatabase(pool: Pool): HistoryDatabase {
  return createAppDatabase(pool, schema);
}
