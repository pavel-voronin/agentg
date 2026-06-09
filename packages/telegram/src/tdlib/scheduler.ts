import type { Invoker, InvokeOptions } from './operationEvents.js';
import { priorities, resolvePriority } from './priority.js';

export type Scheduler = Invoker & {
  close(): void;
  getQueueStats(): QueueStats;
};

export type QueueStats = {
  highestPendingPriority: number | null;
  pendingCount: number;
  runningCount: number;
};

export type SchedulerOptions = {
  maxConcurrent?: number;
};

type QueuedOperation = {
  options: InvokeOptions;
  priority: number;
  reject(error: unknown): void;
  request: Record<string, unknown>;
  resolve(value: unknown): void;
  sequence: number;
};

const DEFAULT_MAX_CONCURRENT_OPERATIONS = 4;

export function createScheduler(client: Invoker, options: SchedulerOptions = {}): Scheduler {
  const maxConcurrent = positiveInteger(options.maxConcurrent, DEFAULT_MAX_CONCURRENT_OPERATIONS);
  let closed = false;
  let runningCount = 0;
  let sequence = 0;
  const queue: QueuedOperation[] = [];

  const drain = (): void => {
    if (closed) {
      return;
    }

    while (runningCount < maxConcurrent && queue.length > 0) {
      const operation = queue.shift();
      if (operation === undefined) {
        return;
      }
      runningCount += 1;
      void client
        .invoke(operation.request, operation.options)
        .then(
          (value) => {
            operation.resolve(value);
          },
          (error: unknown) => {
            operation.reject(error);
          }
        )
        .finally(() => {
          runningCount -= 1;
          drain();
        });
    }
  };

  return {
    close(): void {
      closed = true;
      const pending = queue.splice(0);
      for (const operation of pending) {
        operation.reject(new Error('TDLib scheduler is closed'));
      }
    },
    getQueueStats(): QueueStats {
      return {
        highestPendingPriority:
          queue.length === 0 ? null : Math.max(...queue.map((operation) => operation.priority)),
        pendingCount: queue.length,
        runningCount
      };
    },
    invoke(request: Record<string, unknown>, options: InvokeOptions = {}): Promise<unknown> {
      if (closed) {
        return Promise.reject(new Error('TDLib scheduler is closed'));
      }

      return new Promise((resolve, reject) => {
        queue.push({
          options,
          priority: resolvePriority(options.priority, priorities.low),
          reject,
          request,
          resolve,
          sequence
        });
        sequence += 1;
        queue.sort(compareQueuedOperations);
        drain();
      });
    }
  };
}

export function shouldDeferBackgroundTdlibWork(client: Invoker): boolean {
  const stats = client.getQueueStats?.();
  return (
    stats !== undefined &&
    (stats.runningCount >= DEFAULT_MAX_CONCURRENT_OPERATIONS ||
      (stats.highestPendingPriority ?? 0) >= priorities.maximum)
  );
}

function compareQueuedOperations(left: QueuedOperation, right: QueuedOperation): number {
  return right.priority - left.priority || left.sequence - right.sequence;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
