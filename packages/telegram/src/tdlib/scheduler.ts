import type { Invoker, InvokeOptions, QueueStats } from './operationTypes.js';
import { priorities, resolvePriority } from './priority.js';

export type Scheduler = Invoker & {
  close(): void;
  getQueueStats(): QueueStats;
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
  settled: boolean;
  started: boolean;
  timeout?: ReturnType<typeof setTimeout> | undefined;
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
      if (operation.settled) {
        continue;
      }
      operation.started = true;
      runningCount += 1;
      const clientOptions = { ...operation.options };
      delete clientOptions.timeoutMs;
      void client
        .invoke(operation.request, clientOptions)
        .then(
          (value) => {
            settleOperation(operation, () => {
              operation.resolve(value);
            });
          },
          (error: unknown) => {
            settleOperation(operation, () => {
              operation.reject(error);
            });
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
        settleOperation(operation, () => {
          operation.reject(new Error('TDLib scheduler is closed'));
        });
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
        const operation: QueuedOperation = {
          options,
          priority: resolvePriority(options.priority, priorities.low),
          reject,
          request,
          resolve,
          sequence,
          settled: false,
          started: false
        };
        const timeoutMs = timeoutMilliseconds(options.timeoutMs);
        if (timeoutMs !== undefined) {
          operation.timeout = setTimeout(() => {
            timeoutOperation(operation, queue, timeoutMs);
          }, timeoutMs);
          operation.timeout.unref();
        }
        queue.push(operation);
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

function timeoutOperation(
  operation: QueuedOperation,
  queue: QueuedOperation[],
  timeoutMs: number
): void {
  if (operation.settled) {
    return;
  }
  if (!operation.started) {
    const index = queue.indexOf(operation);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }
  settleOperation(operation, () => {
    operation.reject(
      new Error(
        `TDLib operation timed out after ${String(timeoutMs)} ms: ${String(operation.request._)}`
      )
    );
  });
}

function settleOperation(operation: QueuedOperation, settle: () => void): void {
  if (operation.settled) {
    return;
  }
  operation.settled = true;
  if (operation.timeout !== undefined) {
    clearTimeout(operation.timeout);
    operation.timeout = undefined;
  }
  settle();
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function timeoutMilliseconds(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  throw new Error(`TDLib timeout must be a positive integer in milliseconds: ${String(value)}`);
}
