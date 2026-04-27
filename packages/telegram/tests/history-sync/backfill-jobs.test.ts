import { describe, it } from 'vitest';

describe('backfill jobs', () => {
  it.todo('claims a runnable job without calling Telegram during reconciliation');
  it.todo('stores paging position while a job is in progress');
  it.todo('persists fetched messages before extending coverage');
  it.todo('extends coverage for the interval covered by a completed job');
  it.todo('leaves coverage unchanged for an incomplete job');
});
