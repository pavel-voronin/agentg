import type { Database } from 'better-sqlite3';

export type SqliteMigration = {
  id: string;
  name: string;
  up(database: Database): void;
};

export type AppliedSqliteMigration = {
  appliedAt: string;
  id: string;
  name: string;
};
