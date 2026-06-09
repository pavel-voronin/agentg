import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

const logs = vi.hoisted(() => [] as Record<string, unknown>[]);
const telemetry = vi.hoisted(() => ({
  incrementTelemetryCounter: vi.fn(),
  setTelemetryGauge: vi.fn()
}));

vi.mock('@agentg/framework', () => ({
  createLogger: () => ({
    info() {
      return undefined;
    },
    warn(entry: Record<string, unknown>) {
      logs.push(entry);
    }
  }),
  incrementTelemetryCounter: telemetry.incrementTelemetryCounter,
  logError: (error: unknown) => ({
    'error.type': error instanceof Error ? error.name : typeof error,
    error
  }),
  setTelemetryGauge: telemetry.setTelemetryGauge,
  timeTelemetrySpan: (_options: unknown, operation: () => Promise<unknown>) => operation()
}));

import {
  fileDownloadRequest,
  logTdlibCleanupError,
  processQueuedFileBatch
} from '../src/files/queue.js';
import type { Database } from '../src/database/client.js';
import type { FileDownloadRow, FileSubsystemOptions } from '../src/files/runtime.js';

describe('Telegram file download worker', () => {
  afterEach(() => {
    logs.length = 0;
    telemetry.incrementTelemetryCounter.mockReset();
    telemetry.setTelemetryGauge.mockReset();
    vi.restoreAllMocks();
  });

  it('uses TDLib download list transport for message-owned files', () => {
    expect(
      fileDownloadRequest({
        ...downloadRow(),
        latestTdlibFileId: 123,
        priority: 32,
        transport: {
          chatId: -10042,
          kind: 'message',
          messageId: 777
        }
      })
    ).toEqual({
      chatId: -10042,
      fileId: 123,
      kind: 'message',
      messageId: 777,
      priority: 32
    });
  });

  it('uses async downloadFile transport for non-message files', () => {
    expect(
      fileDownloadRequest({
        ...downloadRow(),
        latestTdlibFileId: 456,
        priority: 8,
        transport: {
          kind: 'file'
        }
      })
    ).toEqual({
      fileId: 456,
      kind: 'file',
      limit: 0,
      offset: 0,
      priority: 8,
      synchronous: false
    });
  });

  it('rejects priorities outside TDLib native range', () => {
    expect(() =>
      fileDownloadRequest({
        ...downloadRow(),
        priority: 33
      })
    ).toThrow('TDLib priority must be an integer from 1 to 32');
  });

  it("treats TDLib cleanup Can't find file as a no-op", () => {
    logTdlibCleanupError('asset-a', new Error("Can't find file"));

    expect(logs).toEqual([]);
  });

  it('keeps warning for real TDLib cleanup failures', () => {
    logTdlibCleanupError('asset-a', new Error('TDLib transport failed'));

    expect(logs).toEqual([
      expect.objectContaining({
        assetKey: 'asset-a',
        event: 'telegram.file_download_cleanup_failed'
      })
    ]);
  });

  it('defers file downloads when the shared TDLib scheduler is busy', async () => {
    const captured: { staleOrderBy?: SQL } = {};
    const tdlib = {
      addFileToDownloads: vi.fn(),
      downloadFile: vi.fn(),
      getFile: vi.fn(),
      getQueueStats() {
        return {
          highestPendingPriority: null,
          pendingCount: 0,
          runningCount: 4
        };
      }
    };
    const database = pressureDatabase(captured, {
      downloading: false,
      queued: true
    });

    const result = await processQueuedFileBatch(
      workerOptions({
        database,
        tdlib
      }),
      {
        maxConcurrentDownloads: 1,
        maxFilesPerTick: 1
      }
    );

    expect(result).toEqual({
      delayedCount: 1,
      failedCount: 0,
      immediateCount: 0,
      processedCount: 0,
      readyCount: 0,
      watchdogCount: 0
    });
    expect(tdlib.getFile).not.toHaveBeenCalled();
    expect(tdlib.downloadFile).not.toHaveBeenCalled();
    expect(tdlib.addFileToDownloads).not.toHaveBeenCalled();
    expect(telemetry.incrementTelemetryCounter).not.toHaveBeenCalled();
    expect(captured.staleOrderBy).toBeDefined();
  });

  it('keeps downloading-only work on the stale watchdog under scheduler pressure', async () => {
    const tdlib = {
      addFileToDownloads: vi.fn(),
      downloadFile: vi.fn(),
      getFile: vi.fn(),
      getQueueStats() {
        return {
          highestPendingPriority: null,
          pendingCount: 0,
          runningCount: 4
        };
      }
    };

    const result = await processQueuedFileBatch(
      workerOptions({
        database: pressureDatabase(
          {},
          {
            downloading: true,
            queued: false
          }
        ),
        tdlib
      }),
      {
        maxConcurrentDownloads: 1,
        maxFilesPerTick: 1
      }
    );

    expect(result).toEqual({
      delayedCount: 0,
      failedCount: 0,
      immediateCount: 0,
      processedCount: 0,
      readyCount: 0,
      watchdogCount: 1
    });
    expect(tdlib.getFile).not.toHaveBeenCalled();
    expect(tdlib.downloadFile).not.toHaveBeenCalled();
    expect(tdlib.addFileToDownloads).not.toHaveBeenCalled();
  });

  it('orders stale download scans by the stale index expression', async () => {
    const captured: { orderBy?: SQL } = {};
    const result = await processQueuedFileBatch(
      workerOptions({
        database: staleOrderDatabase(captured),
        tdlib: idleTdlib()
      }),
      {
        maxConcurrentDownloads: 1,
        maxFilesPerTick: 1
      }
    );

    expect(result.processedCount).toBe(0);
    const orderBy = captured.orderBy;
    if (orderBy === undefined) {
      throw new Error('Stale order expression was not captured');
    }
    const query = new PgDialect().sqlToQuery(orderBy);
    expect(query.sql).toContain(
      'coalesce("telegram_file_download_jobs"."claimed_at", "telegram_file_download_jobs"."updated_at")'
    );
  });
});

function downloadRow(): FileDownloadRow {
  return {
    assetKey: 'asset-a',
    byteSize: 1024,
    fileName: 'file.jpg',
    latestTdlibFileId: 1,
    mimeType: 'image/jpeg',
    priority: 16,
    transport: {
      kind: 'file'
    }
  };
}

function workerOptions(input: { database: Database; tdlib: unknown }): FileSubsystemOptions {
  return {
    database: input.database,
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
      subscribe() {
        return {
          unsubscribe() {
            return undefined;
          }
        };
      }
    },
    filesDirectory: '/tmp/agentg-test-files',
    tdlib: input.tdlib
  } as unknown as FileSubsystemOptions;
}

function idleTdlib() {
  return {
    getQueueStats() {
      return {
        highestPendingPriority: null,
        pendingCount: 0,
        runningCount: 0
      };
    }
  };
}

function pressureDatabase(
  captured: { staleOrderBy?: SQL },
  rows: { downloading: boolean; queued: boolean }
): Database {
  let selectCount = 0;
  return {
    select() {
      selectCount += 1;
      if (selectCount === 1) {
        return {
          from() {
            return {
              where() {
                return {
                  orderBy(orderBy: SQL) {
                    captured.staleOrderBy = orderBy;
                    return {
                      limit() {
                        return Promise.resolve([]);
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }
      const hasRow = selectCount === 2 ? rows.queued : rows.downloading;
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  return Promise.resolve(hasRow ? [{ assetKey: 'asset-a' }] : []);
                }
              };
            }
          };
        }
      };
    }
  } as unknown as Database;
}

function staleOrderDatabase(captured: { orderBy?: SQL }): Database {
  let selectCount = 0;
  return {
    select() {
      selectCount += 1;
      if (selectCount === 1) {
        return {
          from() {
            return {
              where() {
                return {
                  orderBy(orderBy: SQL) {
                    captured.orderBy = orderBy;
                    return {
                      limit() {
                        return Promise.resolve([]);
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }
      return {
        from() {
          return {
            where() {
              return {
                orderBy() {
                  return {
                    limit() {
                      return Promise.resolve([]);
                    }
                  };
                },
                limit() {
                  return Promise.resolve([]);
                }
              };
            }
          };
        }
      };
    }
  } as unknown as Database;
}
