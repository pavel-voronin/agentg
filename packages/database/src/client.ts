import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

export type AppDatabase<TSchema extends Record<string, unknown> = Record<string, never>> =
  NodePgDatabase<TSchema>;

export function createAppDatabase<TSchema extends Record<string, unknown>>(
  pool: Pool,
  schema: TSchema
): AppDatabase<TSchema> {
  return drizzle(pool, { schema });
}
