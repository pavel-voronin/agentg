import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool, type PoolConfig } from 'pg';

import { startTelemetrySpan } from '../telemetry/index.js';

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
  const pool = instrumentPool(
    new Pool({
      ...options.pool,
      connectionString: options.url
    })
  );
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

type QueryCallback = (error: Error | null | undefined, result: unknown) => void;
type QueryMethod = (first: unknown, ...rest: unknown[]) => unknown;

function instrumentPool(pool: Pool): Pool {
  const originalQuery = pool.query.bind(pool) as QueryMethod;
  pool.query = ((first: unknown, ...rest: unknown[]) => {
    const query = queryTelemetry(first);
    const span =
      query === null
        ? null
        : startTelemetrySpan({
            detail: {
              classification: query.classification,
              operation: query.operation,
              relations: query.relations
            },
            kind: 'postgres.query',
            name: query.name
          });

    if (span === null) {
      return originalQuery(first, ...rest);
    }

    const callbackIndex = rest.findIndex((value) => typeof value === 'function');
    if (callbackIndex !== -1) {
      const callback = rest[callbackIndex] as QueryCallback;
      const nextRest = [...rest];
      nextRest[callbackIndex] = (error: Error | null | undefined, result: unknown): void => {
        span.finish({ error: error ?? undefined, ok: error === null || error === undefined });
        callback(error, result);
      };
      return originalQuery(first, ...nextRest);
    }

    const result = originalQuery(first, ...rest);
    if (isPromiseLike(result)) {
      return result
        .then((value: unknown) => {
          span.finish({ ok: true });
          return value;
        })
        .catch((error: unknown) => {
          span.finish({ error, ok: false });
          throw error;
        });
    }

    span.finish({ ok: true });
    return result;
  }) as Pool['query'];

  return pool;
}

type QueryTelemetry = {
  classification: QueryClassification;
  name: string;
  operation: string;
  relations: string[];
};

type QueryClassification = 'maintenance' | 'read' | 'schema' | 'transaction' | 'unknown' | 'write';

function queryTelemetry(query: unknown): QueryTelemetry | null {
  const sql = querySql(query);
  if (sql === null) {
    return null;
  }

  const operation = queryOperation(sql);
  const relations = queryRelations(sql);
  return {
    classification: queryClassification(operation),
    name: relations.length === 0 ? operation : `${operation} ${relations.join(',')}`,
    operation,
    relations
  };
}

function querySql(query: unknown): string | null {
  if (typeof query === 'string') {
    return query;
  }
  if (isRecord(query) && typeof query.text === 'string') {
    return query.text;
  }
  return null;
}

function queryOperation(sql: string): string {
  const operation = /^\s*([a-z]+)/i.exec(sql)?.[1];
  return operation === undefined ? 'query' : operation.toLowerCase();
}

function queryRelations(sql: string): string[] {
  const relations = new Set<string>();
  const relationPattern =
    /\b(?:from|join|into|update)\s+(?:(?:"?[a-zA-Z_][a-zA-Z0-9_]*"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?)/gi;
  for (const match of sql.matchAll(relationPattern)) {
    const relation = match[1];
    if (relation !== undefined) {
      relations.add(relation);
    }
  }
  return [...relations].sort();
}

function queryClassification(operation: string): QueryClassification {
  if (['select', 'show', 'explain', 'describe'].includes(operation)) {
    return 'read';
  }
  if (['insert', 'update', 'delete', 'merge', 'truncate', 'copy'].includes(operation)) {
    return 'write';
  }
  if (['create', 'alter', 'drop', 'comment', 'grant', 'revoke'].includes(operation)) {
    return 'schema';
  }
  if (['begin', 'commit', 'rollback', 'savepoint', 'release'].includes(operation)) {
    return 'transaction';
  }
  if (['analyze', 'vacuum', 'checkpoint', 'listen', 'notify', 'set', 'reset'].includes(operation)) {
    return 'maintenance';
  }
  return 'unknown';
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return isRecord(value) && typeof value.then === 'function' && typeof value.catch === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
