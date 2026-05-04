import type { SqliteMigration } from '../storage/migrations/types.js';

export const historyPruneCompletedJobsMigration: SqliteMigration = {
  id: '0010',
  name: 'history_prune_completed_jobs',
  up(database): void {
    database
      .prepare(
        `
          DELETE FROM history_jobs
          WHERE status NOT IN ('queued', 'running')
        `
      )
      .run();
  }
};
