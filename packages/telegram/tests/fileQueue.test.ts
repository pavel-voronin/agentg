import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { Message, file } from 'tdlib-types';

const logs = vi.hoisted(() => [] as Record<string, unknown>[]);
const logMessages = vi.hoisted(() => [] as string[]);
const telemetry = vi.hoisted(() => ({
  incrementTelemetryCounter: vi.fn(),
  setTelemetryGauge: vi.fn()
}));

vi.mock('@agentg/framework', () => ({
  createLogger: () => ({
    info() {
      return undefined;
    },
    warn(entry: Record<string, unknown>, message?: string) {
      logs.push(entry);
      if (message !== undefined) {
        logMessages.push(message);
      }
    }
  }),
  incrementTelemetryCounter: telemetry.incrementTelemetryCounter,
  logError: (error: unknown) => ({
    'error.type': error instanceof Error ? error.name : typeof error,
    error
  }),
  logContext: (attributes: Record<string, unknown>) => ({
    logContext: attributes
  }),
  setTelemetryGauge: telemetry.setTelemetryGauge,
  timeTelemetrySpan: (_options: unknown, operation: () => Promise<unknown>) => operation(),
  toJsonValue: (value: unknown) => value
}));

import {
  fileDownloadRequest,
  logTdlibCleanupError,
  processCompletedFileBatch,
  processQueuedFileBatch
} from '../src/files/queue.js';
import type { Database } from '../src/database/client.js';
import type {
  CompletedFileAsset,
  FileDownloadRow,
  FileSubsystemOptions
} from '../src/files/runtime.js';

describe('Telegram file download worker', () => {
  afterEach(() => {
    logs.length = 0;
    logMessages.length = 0;
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
    ).toThrow('Telegram file operation priority must be an integer from 1 to 32');
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
        event: 'telegram.file_download_cleanup_failed',
        logContext: {
          assetKey: 'asset-a'
        }
      })
    ]);
  });

  it('defers file downloads when the shared TDLib scheduler is busy', async () => {
    const captured: { staleOrderBy?: SQL } = {};
    const operations = {
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
        operations
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
    expect(operations.getFile).not.toHaveBeenCalled();
    expect(operations.downloadFile).not.toHaveBeenCalled();
    expect(operations.addFileToDownloads).not.toHaveBeenCalled();
    expect(telemetry.incrementTelemetryCounter).not.toHaveBeenCalled();
    expect(captured.staleOrderBy).toBeDefined();
  });

  it('keeps downloading-only work on the stale watchdog under scheduler pressure', async () => {
    const operations = {
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
        operations
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
    expect(operations.getFile).not.toHaveBeenCalled();
    expect(operations.downloadFile).not.toHaveBeenCalled();
    expect(operations.addFileToDownloads).not.toHaveBeenCalled();
  });

  it('orders stale download scans by the stale index expression', async () => {
    const captured: { orderBy?: SQL } = {};
    const result = await processQueuedFileBatch(
      workerOptions({
        database: staleOrderDatabase(captured),
        operations: idleOperations()
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

  it('redispatches stale downloading jobs and increments their attempt count', async () => {
    const deleted = { count: 0 };
    const updates: Record<string, unknown>[] = [];
    const operations = {
      addFileToDownloads: vi.fn(),
      downloadFile: vi.fn().mockResolvedValue(undefined),
      getFile: vi.fn().mockResolvedValue(undefined),
      getQueueStats() {
        return {
          highestPendingPriority: null,
          pendingCount: 0,
          runningCount: 0
        };
      }
    };

    const result = await processQueuedFileBatch(
      workerOptions({
        database: staleDownloadDatabase({
          attempts: 1,
          deleted,
          updates
        }),
        operations
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
      processedCount: 1,
      readyCount: 0,
      watchdogCount: 1
    });
    expect(operations.downloadFile).toHaveBeenCalledTimes(1);
    expect(operations.addFileToDownloads).not.toHaveBeenCalled();
    expect(deleted.count).toBe(0);
    expect(updates).toHaveLength(1);
    const redispatchUpdate = updates[0];
    if (redispatchUpdate === undefined) {
      throw new Error('Expected stale redispatch update');
    }
    expect(redispatchUpdate).toMatchObject({
      lastError: null,
      status: 'downloading'
    });
    expect(redispatchUpdate).toHaveProperty('attempts');
  });

  it('continues immediately when stale download backlog exceeds the tick limit', async () => {
    const deleted = { count: 0 };
    const updates: Record<string, unknown>[] = [];
    const operations = {
      addFileToDownloads: vi.fn(),
      downloadFile: vi.fn().mockResolvedValue(undefined),
      getFile: vi.fn().mockResolvedValue(undefined),
      getQueueStats() {
        return {
          highestPendingPriority: null,
          pendingCount: 0,
          runningCount: 0
        };
      }
    };

    const result = await processQueuedFileBatch(
      workerOptions({
        database: staleDownloadDatabase({
          attempts: 1,
          deleted,
          staleAssetKeys: ['asset-a', 'asset-b'],
          updates
        }),
        operations
      }),
      {
        maxConcurrentDownloads: 1,
        maxFilesPerTick: 1
      }
    );

    expect(result).toEqual({
      delayedCount: 0,
      failedCount: 0,
      immediateCount: 1,
      processedCount: 1,
      readyCount: 0,
      watchdogCount: 1
    });
    expect(operations.downloadFile).toHaveBeenCalledTimes(1);
    expect(deleted.count).toBe(0);
    expect(updates).toHaveLength(1);
  });

  it('fails stale downloading jobs after the stale retry limit', async () => {
    const deleted = { count: 0 };
    const updates: Record<string, unknown>[] = [];
    const operations = {
      addFileToDownloads: vi.fn(),
      downloadFile: vi.fn(),
      getFile: vi.fn().mockResolvedValue(undefined),
      getQueueStats() {
        return {
          highestPendingPriority: null,
          pendingCount: 0,
          runningCount: 0
        };
      }
    };

    const result = await processQueuedFileBatch(
      workerOptions({
        database: staleDownloadDatabase({
          attempts: 3,
          deleted,
          updates
        }),
        operations
      }),
      {
        maxConcurrentDownloads: 1,
        maxFilesPerTick: 1
      }
    );

    expect(result).toEqual({
      delayedCount: 0,
      failedCount: 1,
      immediateCount: 0,
      processedCount: 1,
      readyCount: 0,
      watchdogCount: 0
    });
    expect(operations.downloadFile).not.toHaveBeenCalled();
    expect(deleted.count).toBe(1);
    expect(updates).toEqual([
      expect.objectContaining({
        downloadError: 'Telegram file download stale retry limit reached after 3 attempts',
        status: 'failed'
      })
    ]);
    expect(logs).toContainEqual(
      expect.objectContaining({
        assetKey: 'asset-a',
        attempts: 3,
        decision: 'retry_limit',
        event: 'telegram.file_download_stale_retry_limit',
        latestTdlibFileId: 1,
        nextAttempt: 3,
        tdlibFileId: null,
        tdlibLocalCanBeDownloaded: null,
        tdlibLocalDownloadedSize: null,
        tdlibLocalIsDownloadingCompleted: null,
        tdlibRemoteUniqueId: null,
        tdlibSnapshotPresent: false,
        transport: 'file'
      })
    );
    expect(logMessages).toContain(
      'telegram file download reached stale retry limit asset=asset-a attempts=3 next=3 owner=- ownerId=- slot=- media=photo tdlib=- tdlibDownloaded=- tdlibActive=- tdlibCompleted=- tdlibPath=-'
    );
  });

  it('refreshes message-owned stale TDLib pointers before dispatch', async () => {
    const deleted = { count: 0 };
    const updates: Record<string, unknown>[] = [];
    const operations = {
      addFileToDownloads: vi.fn().mockResolvedValue(undefined),
      downloadFile: vi.fn(),
      getFile: vi.fn(),
      getMessageContent: vi.fn().mockResolvedValue(
        messageWithPhoto({
          chatId: -10042,
          file: tdlibFile({
            id: 2,
            uniqueId: 'asset-a'
          }),
          messageId: 777
        }).content
      ),
      getQueueStats() {
        return {
          highestPendingPriority: null,
          pendingCount: 0,
          runningCount: 0
        };
      }
    };

    const result = await processQueuedFileBatch(
      workerOptions({
        database: queuedPointerMismatchDatabase({
          deleted,
          row: messageDownloadRow({
            assetKey: 'telegram:asset-a',
            remoteUniqueId: 'asset-b'
          }),
          updates
        }),
        operations
      }),
      {
        maxConcurrentDownloads: 1,
        maxFilesPerTick: 1
      }
    );

    expect(result).toEqual({
      delayedCount: 0,
      failedCount: 0,
      immediateCount: 1,
      processedCount: 1,
      readyCount: 0,
      watchdogCount: 1
    });
    expect(operations.getMessageContent).toHaveBeenCalledWith(
      {
        chatId: -10042,
        messageId: 777
      },
      {
        priority: 16
      }
    );
    expect(operations.addFileToDownloads).toHaveBeenCalledWith(
      {
        chatId: -10042,
        fileId: 2,
        messageId: 777,
        priority: 16
      },
      {
        priority: 16
      }
    );
    expect(operations.downloadFile).not.toHaveBeenCalled();
    expect(deleted.count).toBe(0);
    expect(updates).toEqual([
      expect.objectContaining({
        lastError: null,
        status: 'downloading'
      }),
      expect.objectContaining({
        lastError: null,
        status: 'downloading'
      })
    ]);
    expect(telemetry.incrementTelemetryCounter).toHaveBeenCalledWith(
      'telegram.file.worker.recovery.outcomes',
      1,
      {
        'telegram.file.transport': 'message',
        'telegram.file.worker.recovery.outcome': 'refreshed'
      }
    );
  });

  it('fails non-message stale TDLib pointers without dispatching TDLib downloads', async () => {
    const deleted = { count: 0 };
    const updates: Record<string, unknown>[] = [];
    const operations = {
      addFileToDownloads: vi.fn(),
      downloadFile: vi.fn(),
      getFile: vi.fn(),
      getMessageContent: vi.fn(),
      getQueueStats() {
        return {
          highestPendingPriority: null,
          pendingCount: 0,
          runningCount: 0
        };
      }
    };

    const result = await processQueuedFileBatch(
      workerOptions({
        database: queuedPointerMismatchDatabase({
          deleted,
          row: {
            ...downloadRow(),
            assetKey: 'telegram:asset-a',
            remoteUniqueId: 'asset-b'
          },
          updates
        }),
        operations
      }),
      {
        maxConcurrentDownloads: 1,
        maxFilesPerTick: 1
      }
    );

    expect(result).toEqual({
      delayedCount: 0,
      failedCount: 1,
      immediateCount: 1,
      processedCount: 1,
      readyCount: 0,
      watchdogCount: 0
    });
    expect(operations.getMessageContent).not.toHaveBeenCalled();
    expect(operations.getFile).not.toHaveBeenCalled();
    expect(operations.downloadFile).not.toHaveBeenCalled();
    expect(operations.addFileToDownloads).not.toHaveBeenCalled();
    expect(deleted.count).toBe(1);
    expect(updates).toEqual([
      expect.objectContaining({
        lastError: null,
        status: 'downloading'
      }),
      expect.objectContaining({
        status: 'failed'
      })
    ]);
    const failureUpdate = updates[1];
    if (failureUpdate === undefined) {
      throw new Error('Expected failed update');
    }
    expect(String(failureUpdate.downloadError)).toContain(
      'Telegram file asset TDLib pointer is stale'
    );
    expect(telemetry.incrementTelemetryCounter).toHaveBeenCalledWith(
      'telegram.file.worker.recovery.outcomes',
      1,
      {
        'telegram.file.transport': 'file',
        'telegram.file.worker.recovery.outcome': 'unsupported_owner'
      }
    );
  });

  it('fails completed files whose TDLib local path resolves outside the files directory', async () => {
    const filesDirectory = await mkdtemp(join(tmpdir(), 'agentg-td-files-'));
    const outsideDirectory = await mkdtemp(join(tmpdir(), 'agentg-outside-file-'));
    const outsidePath = join(outsideDirectory, 'file.jpg');
    await writeFile(outsidePath, 'secret');
    const updates: Record<string, unknown>[] = [];

    try {
      const result = await processCompletedFileBatch(
        {
          ...workerOptions({
            database: completedPathFailureDatabase(updates),
            operations: idleOperations()
          }),
          filesDirectory,
          tdlibSourceDirectories: [filesDirectory]
        },
        new Map<string, CompletedFileAsset>([
          [
            'asset-a',
            {
              assetKey: 'asset-a',
              localPath: outsidePath,
              tdlibFileId: 1
            }
          ]
        ]),
        1
      );

      expect(result).toMatchObject({
        failedCount: 1,
        readyCount: 0
      });
      expect(updates).toEqual([
        expect.objectContaining({
          downloadError:
            'Telegram TDLib local file path is outside the configured source directories',
          status: 'failed'
        })
      ]);
    } finally {
      await rm(filesDirectory, { force: true, recursive: true });
      await rm(outsideDirectory, { force: true, recursive: true });
    }
  });

  it('canonicalizes completed files from any configured TDLib source directory', async () => {
    const filesDirectory = await mkdtemp(join(tmpdir(), 'agentg-td-files-'));
    const databaseDirectory = await mkdtemp(join(tmpdir(), 'agentg-td-database-'));
    const localPath = join(databaseDirectory, 'profile-photo.jpg');
    await writeFile(localPath, 'secret');
    const updates: Record<string, unknown>[] = [];

    try {
      const result = await processCompletedFileBatch(
        {
          ...workerOptions({
            database: completedPathFailureDatabase(updates),
            operations: idleOperations()
          }),
          filesDirectory,
          tdlibSourceDirectories: [filesDirectory, databaseDirectory]
        },
        new Map<string, CompletedFileAsset>([
          [
            'asset-a',
            {
              assetKey: 'asset-a',
              localPath,
              tdlibFileId: 1
            }
          ]
        ]),
        1
      );

      expect(result).toMatchObject({
        failedCount: 0,
        readyCount: 1
      });
      expect(updates).toEqual([
        expect.objectContaining({
          downloadError: null,
          status: 'ready'
        })
      ]);
      expect(updates[0]?.relativePath).toEqual(expect.stringMatching(/^agentg-media\/.+\.jpg$/));
    } finally {
      await rm(filesDirectory, { force: true, recursive: true });
      await rm(databaseDirectory, { force: true, recursive: true });
    }
  });

  it('fails completed files when canonical media storage resolves outside the files directory', async () => {
    const filesDirectory = await mkdtemp(join(tmpdir(), 'agentg-td-files-'));
    const outsideDirectory = await mkdtemp(join(tmpdir(), 'agentg-outside-media-'));
    const localPath = join(filesDirectory, 'file.jpg');
    await writeFile(localPath, 'secret');
    await symlink(outsideDirectory, join(filesDirectory, 'agentg-media'));
    const updates: Record<string, unknown>[] = [];

    try {
      const result = await processCompletedFileBatch(
        {
          ...workerOptions({
            database: completedPathFailureDatabase(updates),
            operations: idleOperations()
          }),
          filesDirectory,
          tdlibSourceDirectories: [filesDirectory]
        },
        new Map<string, CompletedFileAsset>([
          [
            'asset-a',
            {
              assetKey: 'asset-a',
              localPath,
              tdlibFileId: 1
            }
          ]
        ]),
        1
      );

      expect(result).toMatchObject({
        failedCount: 1,
        readyCount: 0
      });
      expect(updates).toEqual([
        expect.objectContaining({
          downloadError:
            'Telegram canonical media storage is outside the configured files directory',
          status: 'failed'
        })
      ]);
    } finally {
      await rm(filesDirectory, { force: true, recursive: true });
      await rm(outsideDirectory, { force: true, recursive: true });
    }
  });
});

function downloadRow(): FileDownloadRow {
  return {
    assetKey: 'asset-a',
    attempts: 1,
    byteSize: 1024,
    downloadedByteSize: 0,
    fileName: 'file.jpg',
    latestTdlibFileId: 1,
    mediaKind: 'photo',
    mimeType: 'image/jpeg',
    ownerId: null,
    ownerModel: null,
    priority: 16,
    remoteUniqueId: null,
    slotKey: null,
    transport: {
      kind: 'file'
    }
  };
}

function messageDownloadRow(input: {
  assetKey: string;
  remoteUniqueId: string | null;
}): FileDownloadRow {
  return {
    ...downloadRow(),
    assetKey: input.assetKey,
    ownerId: '-10042:777',
    ownerModel: 'telegram.message',
    remoteUniqueId: input.remoteUniqueId,
    slotKey: 'content.photo.0',
    transport: {
      chatId: -10042,
      kind: 'message',
      messageId: 777
    }
  };
}

function workerOptions(input: { database: Database; operations: unknown }): FileSubsystemOptions {
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
    operations: input.operations,
    tdlibSourceDirectories: ['/tmp/agentg-test-files']
  } as unknown as FileSubsystemOptions;
}

function queuedPointerMismatchDatabase(input: {
  deleted: { count: number };
  row: FileDownloadRow;
  updates: Record<string, unknown>[];
}): Database {
  let currentRow = input.row;
  let firstStatsRead = false;
  let firstJobStatsRead = false;
  let ownerRowsRead = false;
  let refreshed = false;
  let refreshedRowRead = false;
  let secondStatsRead = false;
  let selectCount = 0;
  return {
    delete() {
      return {
        where() {
          input.deleted.count += 1;
          return Promise.resolve([]);
        }
      };
    },
    insert() {
      return {
        values(values: Record<string, unknown>) {
          if (typeof values.tdlibFileId === 'number' && typeof values.remoteUniqueId === 'string') {
            refreshed = true;
            currentRow = {
              ...currentRow,
              latestTdlibFileId: values.tdlibFileId,
              remoteUniqueId: values.remoteUniqueId
            };
          }
          return {
            onConflictDoUpdate() {
              return {
                returning() {
                  if (Object.hasOwn(values, 'assetKey') && Object.hasOwn(values, 'status')) {
                    return Promise.resolve([
                      {
                        assetKey: values.assetKey,
                        downloadError: null,
                        status: 'known'
                      }
                    ]);
                  }
                  return Promise.resolve([{ slotKey: values.slotKey }]);
                }
              };
            }
          };
        }
      };
    },
    select() {
      selectCount += 1;
      if (selectCount === 1) {
        return staleAssetKeySelect([]);
      }
      if (selectCount === 2) {
        return queuedAssetKeySelect(currentRow.assetKey);
      }
      if (selectCount === 3) {
        return downloadRowSelect(currentRow);
      }
      if (refreshed && !refreshedRowRead) {
        refreshedRowRead = true;
        return downloadRowSelect(currentRow);
      }
      if (!firstStatsRead) {
        firstStatsRead = true;
        return fileAssetStatsSelect();
      }
      if (!firstJobStatsRead) {
        firstJobStatsRead = true;
        return fileJobStatsSelect();
      }
      if (!ownerRowsRead) {
        ownerRowsRead = true;
        return ownerRowsSelect();
      }
      if (!secondStatsRead) {
        secondStatsRead = true;
        return fileAssetStatsSelect();
      }
      return fileJobStatsSelect();
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          input.updates.push(values);
          return {
            where() {
              return {
                returning() {
                  return Promise.resolve([{ assetKey: currentRow.assetKey }]);
                },
                then(resolve: (value: unknown[]) => void) {
                  resolve([]);
                }
              };
            }
          };
        }
      };
    }
  } as unknown as Database;
}

function idleOperations() {
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

function staleDownloadDatabase(input: {
  attempts: number;
  deleted: { count: number };
  staleAssetKeys?: string[];
  updates: Record<string, unknown>[];
}): Database {
  let selectCount = 0;
  return {
    delete() {
      return {
        where() {
          input.deleted.count += 1;
          return Promise.resolve([]);
        }
      };
    },
    select() {
      selectCount += 1;
      if (selectCount === 1) {
        return staleAssetKeySelect(input.staleAssetKeys);
      }
      if (selectCount === 2) {
        return staleDownloadRowSelect(input.attempts);
      }
      if (selectCount === 3) {
        return ownerRowsSelect();
      }
      if (selectCount === 4) {
        return fileAssetStatsSelect();
      }
      if (selectCount === 5) {
        return fileJobStatsSelect();
      }
      return emptyQueuedSelect();
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          input.updates.push(values);
          return {
            where() {
              return Promise.resolve([]);
            }
          };
        }
      };
    }
  } as unknown as Database;
}

function completedPathFailureDatabase(updates: Record<string, unknown>[]): Database {
  let selectCount = 0;
  return {
    delete() {
      return {
        where() {
          return Promise.resolve([]);
        }
      };
    },
    select() {
      selectCount += 1;
      if (selectCount === 1) {
        return staleDownloadRowSelect(1);
      }
      if (selectCount === 2) {
        return ownerRowsSelect();
      }
      if (selectCount === 3) {
        return fileAssetStatsSelect();
      }
      return fileJobStatsSelect();
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          updates.push(values);
          return {
            where() {
              return Promise.resolve([]);
            }
          };
        }
      };
    }
  } as unknown as Database;
}

function staleAssetKeySelect(assetKeys = ['asset-a']) {
  return {
    from() {
      return {
        where() {
          return {
            orderBy() {
              return {
                limit() {
                  return Promise.resolve(assetKeys.map((assetKey) => ({ assetKey })));
                }
              };
            }
          };
        }
      };
    }
  };
}

function queuedAssetKeySelect(assetKey: string) {
  return {
    from() {
      return {
        where() {
          return {
            orderBy() {
              return {
                limit() {
                  return Promise.resolve([{ assetKey }]);
                }
              };
            }
          };
        }
      };
    }
  };
}

function downloadRowSelect(row: FileDownloadRow) {
  return {
    from() {
      return {
        innerJoin() {
          return {
            leftJoin() {
              return {
                leftJoin() {
                  return {
                    where() {
                      return {
                        orderBy() {
                          return {
                            limit() {
                              return Promise.resolve([
                                {
                                  assetKey: row.assetKey,
                                  attempts: row.attempts,
                                  byteSize: row.byteSize,
                                  downloadedByteSize: row.downloadedByteSize,
                                  fileName: row.fileName,
                                  latestTdlibFileId: row.latestTdlibFileId,
                                  mediaKind: row.mediaKind,
                                  mimeType: row.mimeType,
                                  ownerId: row.ownerId,
                                  ownerModel: row.ownerModel,
                                  priority: row.priority,
                                  remoteUniqueId: row.remoteUniqueId,
                                  slotKey: row.slotKey
                                }
                              ]);
                            }
                          };
                        }
                      };
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };
}

function staleDownloadRowSelect(attempts: number) {
  return downloadRowSelect({
    ...downloadRow(),
    attempts
  });
}

function ownerRowsSelect() {
  return {
    from() {
      return {
        where() {
          return Promise.resolve([]);
        }
      };
    }
  };
}

function fileAssetStatsSelect() {
  return {
    from() {
      return Promise.resolve([
        {
          failedCount: 0,
          knownCount: 1,
          readyCount: 0,
          readyDownloadedBytes: 0,
          totalCount: 1
        }
      ]);
    }
  };
}

function fileJobStatsSelect() {
  return {
    from() {
      return {
        innerJoin() {
          return {
            where() {
              return Promise.resolve([
                {
                  downloadingCount: 1,
                  knownDownloadedBytes: 0,
                  knownRemainingBytes: 1024,
                  knownTotalBytes: 1024,
                  oldestDownloadingAgeSeconds: 301,
                  oldestDownloadingUnixSeconds: 1781324154,
                  queuedCount: 0,
                  staleDownloadingCount: 1,
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

function emptyQueuedSelect() {
  return {
    from() {
      return {
        where() {
          return {
            limit() {
              return Promise.resolve([]);
            },
            orderBy() {
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

function messageWithPhoto(input: { chatId: number; file: file; messageId: number }): Message {
  return {
    _: 'message',
    chat_id: input.chatId,
    content: {
      _: 'messagePhoto',
      photo: {
        _: 'photo',
        has_stickers: false,
        minithumbnail: null,
        sizes: [
          {
            _: 'photoSize',
            height: 100,
            photo: input.file,
            type: 'x',
            width: 100
          }
        ]
      }
    },
    id: input.messageId
  } as unknown as Message;
}

function tdlibFile(input: { id: number; uniqueId: string }): file {
  return {
    _: 'file',
    expected_size: 100,
    id: input.id,
    local: {
      _: 'localFile',
      can_be_deleted: true,
      can_be_downloaded: true,
      download_offset: 0,
      downloaded_prefix_size: 0,
      downloaded_size: 0,
      is_downloading_active: false,
      is_downloading_completed: false,
      path: ''
    },
    remote: {
      _: 'remoteFile',
      id: `remote-${input.uniqueId}`,
      is_uploading_active: false,
      is_uploading_completed: true,
      unique_id: input.uniqueId,
      uploaded_size: 0
    },
    size: 100
  };
}
