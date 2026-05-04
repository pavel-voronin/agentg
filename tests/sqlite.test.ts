import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  listAppliedSqliteMigrations,
  openSqliteDatabase,
  runSqliteMigrations
} from '../src/storage/sqlite.js';
import { AGENTG_MIGRATIONS_TABLE, prefixedTableName } from '../src/storage/schema.js';

describe('openSqliteDatabase', () => {
  it('opens a file-backed SQLite database with WAL and migrations', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agentg-sqlite-'));
    const database = openSqliteDatabase({
      path: join(directory, 'agentg.sqlite')
    });

    try {
      expect(database.connection.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(database.connection.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(listAppliedSqliteMigrations(database.connection)).toEqual([
        {
          appliedAt: expect.any(String) as string,
          id: '0001',
          name: 'storage_migrations'
        },
        {
          appliedAt: expect.any(String) as string,
          id: '0002',
          name: 'telegram_domain'
        },
        {
          appliedAt: expect.any(String) as string,
          id: '0003',
          name: 'history_domain'
        },
        {
          appliedAt: expect.any(String) as string,
          id: '0004',
          name: 'summaries_plugin'
        }
      ]);
    } finally {
      database.close();
    }
  });

  it('does not rerun applied migrations', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agentg-sqlite-'));
    const database = openSqliteDatabase({
      path: join(directory, 'agentg.sqlite')
    });
    let calls = 0;

    try {
      const applied = runSqliteMigrations(database.connection, [
        {
          id: '0001',
          name: 'storage_migrations',
          up(): void {
            calls += 1;
          }
        }
      ]);

      expect(applied).toEqual([]);
      expect(calls).toBe(0);
    } finally {
      database.close();
    }
  });
});

describe('storage schema helpers', () => {
  it('builds owner-prefixed table names', () => {
    expect(prefixedTableName('telegram', 'messages')).toBe('telegram_messages');
    expect(prefixedTableName('history', 'coverage')).toBe('history_coverage');
    expect(prefixedTableName('summaries', 'runs')).toBe('summaries_runs');
    expect(prefixedTableName('plugin:claude', 'events')).toBe('claude_events');
    expect(AGENTG_MIGRATIONS_TABLE).toBe('agentg_migrations');
  });
});
