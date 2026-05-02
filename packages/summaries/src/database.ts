import { createAppDatabase, type AppDatabase } from '@agentg/database/client';
import type { Pool } from 'pg';

import * as schema from './schema.js';

export type SummariesDatabase = AppDatabase<typeof schema>;

export function createSummariesDatabase(pool: Pool): SummariesDatabase {
  return createAppDatabase(pool, schema);
}
