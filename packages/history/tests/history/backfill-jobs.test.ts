import { describe, expect, it } from 'vitest';

import {
  checkpointBackfillPage,
  claimNextBackfillJob,
  completeBackfillJob,
  completeBackfillJobAfterPersistingMessages,
  updateBackfillJobCursor
} from '../../src/jobs.js';
import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../../src/constants.js';
import type { BackfillJob, HistoryCoverageInterval } from '../../src/types.js';

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

  it('normalizes claimed job intervals to Telegram-second boundaries', () => {
    expect(
      claimNextBackfillJob([jobAt('job-1', '2026-01-01T00:00:00.250Z', '2026-01-01T00:00:01.250Z')])
    ).toEqual(jobAt('job-1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:02.000Z'));
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

  it('checkpoints page coverage without claiming the oldest fetched second', () => {
    expect(
      checkpointBackfillPage(job('job-1', '2026-01-01', '2026-02-01'), {
        crossedStart: false,
        oldestFetchedMessageDate: dateTime('2026-01-25T12:00:00.000Z'),
        reachedBeginning: false,
        remainingEndAt: date('2026-02-01')
      })
    ).toEqual({
      complete: false,
      coveredInterval: coverageAt('2026-01-25T12:00:01.000Z', '2026-02-01T00:00:00.000Z'),
      remainingEndAt: dateTime('2026-01-25T12:00:01.000Z')
    });
  });

  it('completes page coverage at the job start after crossing the start boundary', () => {
    expect(
      checkpointBackfillPage(job('job-1', '2026-01-01', '2026-02-01'), {
        crossedStart: true,
        oldestFetchedMessageDate: dateTime('2025-12-31T23:59:59.000Z'),
        reachedBeginning: false,
        remainingEndAt: dateTime('2026-01-25T12:00:01.000Z')
      })
    ).toEqual({
      complete: true,
      coveredInterval: coverageAt('2026-01-01T00:00:00.000Z', '2026-01-25T12:00:01.000Z'),
      remainingEndAt: dateTime('2026-01-25T12:00:01.000Z')
    });
  });

  it('covers from the Telegram beginning when a page reaches history start', () => {
    expect(
      checkpointBackfillPage(job('job-1', '2026-01-01', '2026-02-01'), {
        crossedStart: false,
        reachedBeginning: true,
        remainingEndAt: dateTime('2026-01-25T12:00:01.000Z')
      })
    ).toEqual({
      complete: true,
      coveredInterval: {
        chatId: 'chat-a',
        endAt: dateTime('2026-01-25T12:00:01.000Z'),
        startAt: TELEGRAM_HISTORY_PAST_BOUNDARY
      },
      remainingEndAt: dateTime('2026-01-25T12:00:01.000Z')
    });
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

function jobAt(id: string, startAt: string, endAt: string): BackfillJob {
  return {
    chatId: 'chat-a',
    endAt: new Date(endAt),
    id,
    startAt: new Date(startAt),
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

function coverageAt(startAt: string, endAt: string): HistoryCoverageInterval {
  return {
    chatId: 'chat-a',
    endAt: dateTime(endAt),
    startAt: dateTime(startAt)
  };
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateTime(value: string): Date {
  return new Date(value);
}
