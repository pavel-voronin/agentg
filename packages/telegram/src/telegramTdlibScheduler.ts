import type { TdlibInvoker, TdlibInvokeOptions } from './telegramOperationEvents.js';
import { resolveTelegramTdlibPriority, telegramTdlibPriorities } from './telegramTdlibPriority.js';

export type TelegramTdlibScheduler = TdlibInvoker & {
  close(): void;
  getQueueStats(): TelegramTdlibQueueStats;
};

export type TelegramTdlibQueueStats = {
  highestPendingPriority: number | null;
  pendingCount: number;
  runningCount: number;
};

export type TelegramTdlibSchedulerOptions = {
  maxConcurrent?: number;
};

type QueuedTdlibOperation = {
  options: TdlibInvokeOptions;
  priority: number;
  reject(error: unknown): void;
  request: Record<string, unknown>;
  resolve(value: unknown): void;
  sequence: number;
};

const DEFAULT_MAX_CONCURRENT_TDLIB_OPERATIONS = 4;

export function createTelegramTdlibScheduler(
  client: TdlibInvoker,
  options: TelegramTdlibSchedulerOptions = {}
): TelegramTdlibScheduler {
  const maxConcurrent = positiveInteger(
    options.maxConcurrent,
    DEFAULT_MAX_CONCURRENT_TDLIB_OPERATIONS
  );
  let closed = false;
  let runningCount = 0;
  let sequence = 0;
  const queue: QueuedTdlibOperation[] = [];

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
        operation.reject(new Error('Telegram TDLib scheduler is closed'));
      }
    },
    getQueueStats(): TelegramTdlibQueueStats {
      return {
        highestPendingPriority:
          queue.length === 0 ? null : Math.max(...queue.map((operation) => operation.priority)),
        pendingCount: queue.length,
        runningCount
      };
    },
    invoke(request: Record<string, unknown>, options: TdlibInvokeOptions = {}): Promise<unknown> {
      if (closed) {
        return Promise.reject(new Error('Telegram TDLib scheduler is closed'));
      }

      return new Promise((resolve, reject) => {
        queue.push({
          options,
          priority: resolveTelegramTdlibPriority(options.priority, telegramTdlibPriorities.low),
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

export function isTelegramTdlibUnderNavigationPressure(client: TdlibInvoker): boolean {
  const stats = client.getQueueStats?.();
  return (
    stats !== undefined &&
    (stats.runningCount >= DEFAULT_MAX_CONCURRENT_TDLIB_OPERATIONS ||
      (stats.highestPendingPriority ?? 0) >= telegramTdlibPriorities.maximum)
  );
}

function compareQueuedOperations(left: QueuedTdlibOperation, right: QueuedTdlibOperation): number {
  return right.priority - left.priority || left.sequence - right.sequence;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
