import { describe, expect, it } from 'vitest';

import { createUpdateQueue } from './updateQueue.js';

describe('update queue', () => {
  it('limits concurrent update handlers', async () => {
    let runningCount = 0;
    let maxRunningCount = 0;
    const handled: number[] = [];
    const releases: (() => void)[] = [];
    const queue = createUpdateQueue<number>({
      concurrency: 2,
      async handle(item) {
        runningCount += 1;
        maxRunningCount = Math.max(maxRunningCount, runningCount);
        await new Promise<void>((resolve) => {
          releases.push(resolve);
        });
        handled.push(item);
        runningCount -= 1;
      },
      onError(error) {
        throw error;
      }
    });

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    queue.enqueue(4);

    expect(queue.snapshot()).toEqual({
      pendingCount: 2,
      runningCount: 2
    });

    releases.shift()?.();
    releases.shift()?.();
    await drainMicrotasks();

    expect(queue.snapshot()).toEqual({
      pendingCount: 0,
      runningCount: 2
    });

    releases.shift()?.();
    releases.shift()?.();
    await queue.drain();

    expect(handled).toEqual([1, 2, 3, 4]);
    expect(maxRunningCount).toBe(2);
  });

  it('continues after a handler failure', async () => {
    const errors: string[] = [];
    const handled: number[] = [];
    const queue = createUpdateQueue<number>({
      concurrency: 1,
      handle(item) {
        if (item === 2) {
          return Promise.reject(new Error('failed update'));
        }
        handled.push(item);
        return Promise.resolve();
      },
      onError(error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    });

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    await queue.drain();

    expect(handled).toEqual([1, 3]);
    expect(errors).toEqual(['failed update']);
  });

  it('rejects invalid concurrency', () => {
    expect(() =>
      createUpdateQueue({
        concurrency: 0,
        handle() {
          return Promise.resolve();
        },
        onError() {
          return;
        }
      })
    ).toThrow('update queue concurrency must be a positive integer');
  });
});

async function drainMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
