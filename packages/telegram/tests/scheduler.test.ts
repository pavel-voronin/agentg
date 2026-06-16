import { afterEach, describe, expect, it, vi } from 'vitest';

import { priorities } from '../src/tdlib/priority.js';
import { createScheduler } from '../src/tdlib/scheduler.js';

describe('Telegram TDLib scheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs higher priority operations before lower priority queued operations', async () => {
    const calls: string[] = [];
    let releaseRunning: (() => void) | undefined;
    const runningCanFinish = new Promise<void>((resolve) => {
      releaseRunning = resolve;
    });
    const scheduler = createScheduler(
      {
        async invoke(request) {
          const name = String(request._);
          calls.push(name);
          if (name === 'low-running') {
            await runningCanFinish;
          }
          return { _: 'ok' };
        }
      },
      {
        maxConcurrent: 1
      }
    );

    const first = scheduler.invoke({ _: 'low-running' }, { priority: priorities.low });
    await waitUntil(() => calls.includes('low-running'));
    const lowQueued = scheduler.invoke({ _: 'low-queued' }, { priority: priorities.low });
    const highQueued = scheduler.invoke({ _: 'high-queued' }, { priority: priorities.maximum });

    releaseRunning?.();
    await Promise.all([first, highQueued, lowQueued]);
    scheduler.close();

    expect(calls).toEqual(['low-running', 'high-queued', 'low-queued']);
  });

  it('rejects queued operations when their timeout expires before start', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    let releaseRunning: (() => void) | undefined;
    const runningCanFinish = new Promise<void>((resolve) => {
      releaseRunning = resolve;
    });
    const scheduler = createScheduler(
      {
        async invoke(request) {
          const name = String(request._);
          calls.push(name);
          if (name === 'running') {
            await runningCanFinish;
          }
          return { _: 'ok' };
        }
      },
      {
        maxConcurrent: 1
      }
    );

    const running = scheduler.invoke({ _: 'running' });
    const queued = scheduler.invoke({ _: 'queued' }, { timeoutMs: 1000 });
    expect(scheduler.getQueueStats()).toMatchObject({
      pendingCount: 1,
      runningCount: 1
    });

    const queuedTimeout = expect(queued).rejects.toThrow(
      'TDLib operation timed out after 1000 ms: queued'
    );
    await vi.advanceTimersByTimeAsync(1000);
    await queuedTimeout;
    expect(scheduler.getQueueStats()).toMatchObject({
      pendingCount: 0,
      runningCount: 1
    });

    releaseRunning?.();
    await running;
    scheduler.close();
    expect(calls).toEqual(['running']);
  });

  it('rejects running operations on timeout and preserves concurrency accounting', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    let releaseRunning: (() => void) | undefined;
    const runningCanFinish = new Promise<void>((resolve) => {
      releaseRunning = resolve;
    });
    const scheduler = createScheduler(
      {
        async invoke(request) {
          const name = String(request._);
          calls.push(name);
          if (name === 'running') {
            await runningCanFinish;
          }
          return { _: 'ok' };
        }
      },
      {
        maxConcurrent: 1
      }
    );

    const running = scheduler.invoke({ _: 'running' }, { timeoutMs: 1000 });
    const queued = scheduler.invoke({ _: 'queued' });

    const runningTimeout = expect(running).rejects.toThrow(
      'TDLib operation timed out after 1000 ms: running'
    );
    await vi.advanceTimersByTimeAsync(1000);
    await runningTimeout;
    expect(scheduler.getQueueStats()).toMatchObject({
      pendingCount: 1,
      runningCount: 1
    });
    expect(calls).toEqual(['running']);

    releaseRunning?.();
    await queued;
    scheduler.close();
    expect(calls).toEqual(['running', 'queued']);
  });
});

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
  throw new Error('condition was not met');
}
