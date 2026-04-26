import { Pool } from 'pg';

export type DatabaseHealth = {
  now: Date;
  postgresVersion: string;
};

export function createDatabasePool(databaseUrl: string): Pool {
  return new Pool({
    connectionString: databaseUrl,
    max: 5
  });
}

export async function checkDatabase(pool: Pool): Promise<DatabaseHealth> {
  const result = await pool.query<{
    now: Date;
    postgres_version: string;
  }>('select now() as now, version() as postgres_version');

  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('Postgres health query returned no rows');
  }

  return {
    now: row.now,
    postgresVersion: row.postgres_version
  };
}
