import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import DatabaseConstructor, { type Database } from 'better-sqlite3';

import { sqliteMigrations } from './migrations/index.js';
import type { AppliedSqliteMigration, SqliteMigration } from './migrations/types.js';
import { AGENTG_MIGRATIONS_TABLE } from './schema.js';

export type SqliteConfig = {
  path: string;
};

export type SqliteDatabase = {
  close(): void;
  connection: Database;
  path: string;
};

type MigrationRow = {
  applied_at: string;
  id: string;
  name: string;
};

export function openSqliteDatabase(config: SqliteConfig): SqliteDatabase {
  if (config.path === ':memory:') {
    throw new Error('AgenTG requires a file-backed SQLite database');
  }

  mkdirSync(dirname(config.path), { recursive: true });

  const connection = new DatabaseConstructor(config.path);
  configureSqliteConnection(connection);
  runSqliteMigrations(connection, sqliteMigrations);

  return {
    close(): void {
      connection.close();
    },
    connection,
    path: config.path
  };
}

export function configureSqliteConnection(connection: Database): void {
  connection.pragma('journal_mode = WAL');
  connection.pragma('foreign_keys = ON');
  connection.pragma('busy_timeout = 5000');
}

export function runSqliteMigrations(
  connection: Database,
  migrations: readonly SqliteMigration[]
): AppliedSqliteMigration[] {
  validateMigrations(migrations);

  const transaction = connection.transaction(() => {
    ensureMigrationsTable(connection);

    const applied = readAppliedMigrationIds(connection);
    const newlyApplied: AppliedSqliteMigration[] = [];

    for (const migration of migrations) {
      if (applied.has(migration.id)) {
        continue;
      }

      migration.up(connection);
      connection
        .prepare(
          `
            INSERT INTO ${AGENTG_MIGRATIONS_TABLE} (id, name)
            VALUES (?, ?)
          `
        )
        .run(migration.id, migration.name);

      const row = connection
        .prepare(
          `
            SELECT id, name, applied_at
            FROM ${AGENTG_MIGRATIONS_TABLE}
            WHERE id = ?
          `
        )
        .get(migration.id) as MigrationRow;

      newlyApplied.push({
        appliedAt: row.applied_at,
        id: row.id,
        name: row.name
      });
    }

    return newlyApplied;
  });

  return transaction();
}

export function listAppliedSqliteMigrations(connection: Database): AppliedSqliteMigration[] {
  ensureMigrationsTable(connection);

  return connection
    .prepare(
      `
        SELECT id, name, applied_at
        FROM ${AGENTG_MIGRATIONS_TABLE}
        ORDER BY id ASC
      `
    )
    .all()
    .map((row) => {
      const migration = row as MigrationRow;
      return {
        appliedAt: migration.applied_at,
        id: migration.id,
        name: migration.name
      };
    });
}

function ensureMigrationsTable(connection: Database): void {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS ${AGENTG_MIGRATIONS_TABLE} (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
}

function readAppliedMigrationIds(connection: Database): Set<string> {
  return new Set(
    connection
      .prepare(
        `
          SELECT id
          FROM ${AGENTG_MIGRATIONS_TABLE}
        `
      )
      .all()
      .map((row) => (row as { id: string }).id)
  );
}

function validateMigrations(migrations: readonly SqliteMigration[]): void {
  const ids = new Set<string>();
  let previousId: string | undefined;

  for (const migration of migrations) {
    if (!/^[0-9]{4}$/u.test(migration.id)) {
      throw new Error(`SQLite migration id must use four digits: ${migration.id}`);
    }
    if (ids.has(migration.id)) {
      throw new Error(`Duplicate SQLite migration id: ${migration.id}`);
    }
    if (previousId !== undefined && migration.id <= previousId) {
      throw new Error(`SQLite migrations must be sorted: ${migration.id}`);
    }

    ids.add(migration.id);
    previousId = migration.id;
  }
}
