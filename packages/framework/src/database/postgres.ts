import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool, type PoolConfig } from 'pg';

export type PostgresHealth = {
  now: Date;
  postgresVersion: string;
};

export type PostgresMigrations = {
  folder: string;
  table: string;
};

export type PostgresOptions<TSchema extends Record<string, unknown>> = {
  migrations?: PostgresMigrations | undefined;
  pool?: Omit<PoolConfig, 'connectionString'> | undefined;
  schema: TSchema;
  url: string;
};

export type PostgresResource<TSchema extends Record<string, unknown>> = {
  db: NodePgDatabase<TSchema>;
  health(): Promise<PostgresHealth>;
  start(): Promise<() => Promise<undefined>>;
  stop(): Promise<undefined>;
};

export function postgres<TSchema extends Record<string, unknown>>(
  options: PostgresOptions<TSchema>
): PostgresResource<TSchema> {
  const pool = new Pool({
    ...options.pool,
    connectionString: options.url
  });
  const db = drizzle(pool, { schema: options.schema });
  let started = false;

  return {
    db,
    async health() {
      return checkPostgres(pool);
    },
    async start() {
      if (started) {
        return stop;
      }
      try {
        await checkPostgres(pool);
        if (options.migrations !== undefined) {
          await migrate(db, {
            migrationsFolder: options.migrations.folder,
            migrationsTable: options.migrations.table
          });
        }
      } catch (error) {
        await pool.end();
        throw error;
      }
      started = true;
      return stop;
    },
    stop
  };

  async function stop(): Promise<undefined> {
    if (!started) {
      return undefined;
    }
    started = false;
    await pool.end();
    return undefined;
  }
}

async function checkPostgres(pool: Pool): Promise<PostgresHealth> {
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
