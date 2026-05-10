import { describe, expect, it } from 'vitest';

import { telegramTdlibPriorities } from '../src/telegram-tdlib-priority.js';
import { createTelegramTdlibScheduler } from '../src/telegram-tdlib-scheduler.js';

describe('Telegram TDLib scheduler', () => {
  it('runs higher priority operations before lower priority queued operations', async () => {
    const calls: string[] = [];
    let releaseRunning: (() => void) | undefined;
    const runningCanFinish = new Promise<void>((resolve) => {
      releaseRunning = resolve;
    });
    const scheduler = createTelegramTdlibScheduler(
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

    const first = scheduler.invoke({ _: 'low-running' }, { priority: telegramTdlibPriorities.low });
    await waitUntil(() => calls.includes('low-running'));
    const lowQueued = scheduler.invoke(
      { _: 'low-queued' },
      { priority: telegramTdlibPriorities.low }
    );
    const highQueued = scheduler.invoke(
      { _: 'high-queued' },
      { priority: telegramTdlibPriorities.maximum }
    );

    releaseRunning?.();
    await Promise.all([first, highQueued, lowQueued]);
    scheduler.close();

    expect(calls).toEqual(['low-running', 'high-queued', 'low-queued']);
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
