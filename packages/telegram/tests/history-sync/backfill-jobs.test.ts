import { describe, expect, it } from 'vitest';

import {
  claimNextBackfillJob,
  completeBackfillJob,
  completeBackfillJobAfterPersistingMessages,
  updateBackfillJobCursor
} from '../../src/history-sync/jobs.js';
import type { BackfillJob, HistoryCoverageInterval } from '../../src/history-sync/types.js';

describe('backfill jobs', () => {
  it('claims a runnable job without calling Telegram during reconciliation', () => {
    expect(
      claimNextBackfillJob([
        job('older', '2026-01-01', '2026-01-10'),
        job('newer', '2026-01-20', '2026-01-31'),
        { ...job('running', '2026-02-01', '2026-02-10'), status: 'running' }
      ])
    ).toEqual(job('newer', '2026-01-20', '2026-01-31'));
  });

  it('stores paging position while a job is in progress', () => {
    expect(
      updateBackfillJobCursor(job('job-1', '2026-01-01', '2026-01-10'), { messageId: 123 })
    ).toMatchObject({
      cursor: { messageId: 123 },
      status: 'running'
    });
  });

  it('persists fetched messages before extending coverage', async () => {
    const calls: string[] = [];

    await completeBackfillJobAfterPersistingMessages(
      job('job-1', '2026-01-01', '2026-01-10'),
      [{ id: 1 }],
      () => {
        calls.push('messages');
        return Promise.resolve();
      },
      () => {
        calls.push('coverage');
        return Promise.resolve();
      }
    );

    expect(calls).toEqual(['messages', 'coverage']);
  });

  it('extends coverage for the interval covered by a finished job', () => {
    const result = completeBackfillJob(job('job-1', '2026-01-01', '2026-01-10'), []);

    expect(result).toEqual({
      coverage: [coverage('2026-01-01', '2026-01-10')]
    });
  });

  it('leaves coverage unchanged for an incomplete job', () => {
    expect([coverage('2026-01-01', '2026-01-10')]).toEqual([coverage('2026-01-01', '2026-01-10')]);
  });
});

function job(id: string, startAt: string, endAt: string): BackfillJob {
  return {
    chatId: 'chat-a',
    endAt: date(endAt),
    id,
    startAt: date(startAt),
    status: 'pending'
  };
}

function coverage(startAt: string, endAt: string): HistoryCoverageInterval {
  return {
    chatId: 'chat-a',
    endAt: date(endAt),
    startAt: date(startAt)
  };
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
