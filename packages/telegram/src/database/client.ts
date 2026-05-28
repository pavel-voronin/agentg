import { createAppDatabase, type AppDatabase } from '@agentg/database/client';
import type { Pool } from 'pg';

import * as schema from './schema.js';

export type TelegramDatabase = AppDatabase<typeof schema>;

export function createTelegramDatabase(pool: Pool): TelegramDatabase {
  return createAppDatabase(pool, schema);
}
