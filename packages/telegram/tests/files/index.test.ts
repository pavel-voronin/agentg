import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../../src/database/client.js';
import type { FileSubsystemOptions } from '../../src/files/runtime.js';

const emptyBatchResult = {
  delayedCount: 0,
  failedCount: 0,
  immediateCount: 0,
  processedCount: 0,
  readyCount: 0,
  watchdogCount: 0
};

const worker = vi.hoisted(() => ({
  processCompletedFileBatch: vi.fn(),
  processQueuedFileBatch: vi.fn()
}));

const messageSlots = vi.hoisted(() => ({
  processMessageSlotMaterializationBatch: vi.fn()
}));

const telemetry = vi.hoisted(() => ({
  recordQueueStatsTelemetry: vi.fn(),
  recordWorkerBatchResult: vi.fn(),
  recordWorkerWake: vi.fn(),
  timeWorkerStage: vi.fn(
    async (_stage: string, operation: () => Promise<unknown>): Promise<unknown> => operation()
  )
}));

vi.mock('@agentg/framework', () => ({
  createLogger: () => ({
    warn() {
      return undefined;
    }
  }),
  logError: (error: unknown) => ({
    'error.type': error instanceof Error ? error.name : typeof error,
    error
  })
}));

vi.mock('../../src/files/queue.js', () => ({
  logWorkerError: vi.fn(),
  processCompletedFileBatch: worker.processCompletedFileBatch,
  processQueuedFileBatch: worker.processQueuedFileBatch
}));

vi.mock('../../src/files/messageSlots.js', () => ({
  markStoredMessageFileSlotsRecorded: vi.fn(),
  processMessageSlotMaterializationBatch: messageSlots.processMessageSlotMaterializationBatch
}));

vi.mock('../../src/files/telemetry.js', () => ({
  recordQueueStatsTelemetry: telemetry.recordQueueStatsTelemetry,
  recordWorkerBatchResult: telemetry.recordWorkerBatchResult,
  recordWorkerWake: telemetry.recordWorkerWake,
  timeWorkerStage: telemetry.timeWorkerStage
}));

import { useFiles } from '../../src/files/index.js';

describe('Telegram file subsystem worker scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T00:00:00.000Z'));
    worker.processCompletedFileBatch.mockResolvedValue(emptyBatchResult);
    worker.processQueuedFileBatch.mockResolvedValue(emptyBatchResult);
    messageSlots.processMessageSlotMaterializationBatch.mockResolvedValue({
      hasMore: false,
      processedCount: 0,
      queueChanged: false
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('lets new queue events preempt a delayed stale watchdog timer', async () => {
    let queueChanged:
      | ((event: { data: { queuedCount: number }; type: 'telegram.files.queueChanged' }) => void)
      | undefined;
    worker.processQueuedFileBatch
      .mockResolvedValueOnce({
        ...emptyBatchResult,
        watchdogCount: 1
      })
      .mockResolvedValueOnce(emptyBatchResult);

    const runtime = useFiles({
      database: queueStatsDatabase(),
      events: {
        publish() {
          return undefined;
        },
        start() {
          return Promise.resolve();
        },
        stop() {
          return Promise.resolve();
        },
        subscribe(type: string, handler: (event: { data: { queuedCount: number } }) => void) {
          if (type === 'telegram.files.queueChanged') {
            queueChanged = handler;
          }
          return {
            unsubscribe() {
              return undefined;
            }
          };
        }
      },
      filesDirectory: '/tmp/agentg-test-files',
      staleCheckMs: 60_000,
      tdlib: {
        getQueueStats() {
          return {
            highestPendingPriority: null,
            pendingCount: 0,
            runningCount: 0
          };
        }
      }
    } as unknown as FileSubsystemOptions);

    const close = await runtime.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(worker.processQueuedFileBatch).toHaveBeenCalledTimes(1);
    expect(telemetry.recordWorkerWake).toHaveBeenCalledWith('stale_watchdog');

    if (queueChanged === undefined) {
      throw new Error('queueChanged subscription was not registered');
    }
    queueChanged({
      data: {
        queuedCount: 1
      },
      type: 'telegram.files.queueChanged'
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(worker.processQueuedFileBatch).toHaveBeenCalledTimes(2);
    expect(telemetry.recordWorkerWake).toHaveBeenCalledWith('queue_event');
    close();
  });
});

function queueStatsDatabase(): Database {
  let selectCount = 0;
  return {
    select() {
      selectCount += 1;
      if (selectCount % 2 === 1) {
        return {
          from() {
            return Promise.resolve([
              {
                failedCount: 0,
                knownCount: 0,
                readyCount: 0,
                readyDownloadedBytes: 0,
                totalCount: 0
              }
            ]);
          }
        };
      }
      return {
        from() {
          return {
            innerJoin() {
              return {
                where() {
                  return Promise.resolve([
                    {
                      downloadingCount: 0,
                      knownDownloadedBytes: 0,
                      knownRemainingBytes: 0,
                      knownTotalBytes: 0,
                      queuedCount: 0,
                      unknownRemainingCount: 0
                    }
                  ]);
                }
              };
            }
          };
        }
      };
    }
  } as unknown as Database;
}
