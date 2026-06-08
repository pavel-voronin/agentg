import { performance } from 'node:perf_hooks';

type QueueOptions<Item> = {
  concurrency: number;
  handle(item: Item): Promise<void>;
  onStart?(item: Item, waitSeconds: number): void;
  onError(error: unknown, item: Item): void;
};

type QueueSnapshot = {
  pendingCount: number;
  runningCount: number;
};

type Queue<Item> = {
  drain(): Promise<void>;
  enqueue(item: Item): void;
  snapshot(): QueueSnapshot;
};

type DrainResolver = () => void;

type PendingItem<Item> = {
  enqueuedAtMs: number;
  item: Item;
};

export function createUpdateQueue<Item>(options: QueueOptions<Item>): Queue<Item> {
  const concurrency = positiveInteger(options.concurrency, 'update queue concurrency');
  const pending: PendingItem<Item>[] = [];
  const drainResolvers: DrainResolver[] = [];
  let runningCount = 0;

  return {
    drain(): Promise<void> {
      if (pending.length === 0 && runningCount === 0) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        drainResolvers.push(resolve);
      });
    },
    enqueue(item): void {
      pending.push({
        enqueuedAtMs: performance.now(),
        item
      });
      startQueuedItems();
    },
    snapshot(): QueueSnapshot {
      return {
        pendingCount: pending.length,
        runningCount
      };
    }
  };

  function startQueuedItems(): void {
    while (runningCount < concurrency && pending.length > 0) {
      const pendingItem = pending.shift();
      if (pendingItem === undefined) {
        return;
      }

      const waitSeconds = Math.max(0, performance.now() - pendingItem.enqueuedAtMs) / 1000;
      const item = pendingItem.item;
      options.onStart?.(item, waitSeconds);
      runningCount += 1;
      void options
        .handle(item)
        .catch((error: unknown) => {
          options.onError(error, item);
        })
        .finally(() => {
          runningCount -= 1;
          startQueuedItems();
          resolveDrainWhenIdle();
        });
    }
  }

  function resolveDrainWhenIdle(): void {
    if (pending.length > 0 || runningCount > 0) {
      return;
    }

    const resolvers = drainResolvers.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  }
}

function positiveInteger(value: number, label: string): number {
  if (Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  throw new Error(`${label} must be a positive integer`);
}
