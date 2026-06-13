import { describe, expect, it } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import type { Database } from '../../src/database/client.js';
import { readFileQueueStats, readFileRef } from '../../src/files/read.js';
import { chatRef } from '../../src/model/refs.js';

describe('Telegram file read model', () => {
  it('mints canonical ready media URLs', async () => {
    const file = await readFileRef(
      fileRefDatabase('agentg-media/ab/cd/file name.jpg'),
      chatRef('chat-1'),
      'photo.main'
    );

    expect(file?.url).toBe('/telegram-files/agentg-media/ab/cd/file%20name.jpg');
  });

  it.each([
    ['raw/file.jpg'],
    ['agentg-media/../file.jpg'],
    ['agentg-media/%2e%2e/file.jpg'],
    ['agentg-media/a%2Fb.jpg'],
    ['agentg-media/a\\b.jpg'],
    ['agentg-media//file.jpg']
  ])('does not mint non-canonical ready media URL for %s', async (relativePath) => {
    const file = await readFileRef(fileRefDatabase(relativePath), chatRef('chat-1'), 'photo.main');

    expect(file?.url).toBeNull();
  });

  it('does not mint URLs for non-ready assets', async () => {
    const file = await readFileRef(
      fileRefDatabase('agentg-media/file.jpg', 'known'),
      chatRef('chat-1'),
      'photo.main'
    );

    expect(file?.url).toBeNull();
  });

  it('classifies TDLib source-root failures with a bounded reason', async () => {
    const stats = await readFileQueueStats(fileQueueStatsDatabase());

    expect(stats.failureReasonCounts).toContainEqual({
      count: 2,
      reason: 'tdlib_path_outside_source_roots'
    });
    expect(stats.failureReasonCounts).toContainEqual({
      count: 1,
      reason: 'unknown'
    });
    expect(stats.readyDownloadedBytes).toBe(1024);
  });

  it('classifies TDLib not-found failures with a bounded reason', async () => {
    const captured: CapturedFileQueueSql = {};
    const stats = await readFileQueueStats(
      fileQueueStatsDatabase({
        assetRow: {
          failedCount: 3,
          knownCount: 0,
          missingTdlibFileIdFailureCount: 0,
          notFoundFailureCount: 3,
          readyCount: 0,
          readyDownloadedBytes: 0,
          staleRetryLimitFailureCount: 0,
          storageIoFailureCount: 0,
          tdlibPathOutsideSourceRootsFailureCount: 0,
          totalCount: 3,
          unknownFailureCount: 0
        },
        captured
      })
    );

    expect(stats.failureReasonCounts).toContainEqual({
      count: 3,
      reason: 'not_found'
    });
    expect(stats.failureReasonCounts).toContainEqual({
      count: 0,
      reason: 'unknown'
    });
    const notFoundQuery = compileCapturedSql(captured.notFoundFailureCount);
    expect(notFoundQuery.sql).toContain('"telegram_file_assets"."download_error" in');
    expect(notFoundQuery.params).toEqual(
      expect.arrayContaining([
        'Not Found',
        'File not found',
        'Message not found',
        'Message has no specified file'
      ])
    );
    const unknownQuery = compileCapturedSql(captured.unknownFailureCount);
    expect(unknownQuery.sql).toContain('"telegram_file_assets"."download_error" not in');
    expect(unknownQuery.params).toEqual(
      expect.arrayContaining([
        'Not Found',
        'File not found',
        'Message not found',
        'Message has no specified file'
      ])
    );
  });
});

function fileRefDatabase(relativePath: string, status = 'ready'): Database {
  const now = new Date('2026-06-10T00:00:00.000Z');
  return {
    select() {
      return {
        from() {
          return {
            innerJoin() {
              return {
                leftJoin() {
                  return {
                    where() {
                      return Promise.resolve([
                        {
                          assetByteSize: 100,
                          assetDownloadError: null,
                          assetDownloadedByteSize: 100,
                          assetKey: 'telegram:asset-a',
                          assetRelativePath: relativePath,
                          assetStatus: status,
                          assetUpdatedAt: now,
                          byteSize: 100,
                          durationSeconds: null,
                          fileName: 'photo.jpg',
                          height: null,
                          jobStatus: null,
                          mediaKind: 'photo',
                          mimeType: 'image/jpeg',
                          ownerId: 'chat-1',
                          ownerModel: 'telegram.chat',
                          renderKind: 'image',
                          slotKey: 'photo.main',
                          slotUpdatedAt: now,
                          tdlibFileId: 10,
                          width: null
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
  } as unknown as Database;
}

type FileQueueAssetRow = {
  failedCount: number;
  knownCount: number;
  missingTdlibFileIdFailureCount: number;
  notFoundFailureCount: number;
  readyCount: number;
  readyDownloadedBytes: number;
  staleRetryLimitFailureCount: number;
  storageIoFailureCount: number;
  tdlibPathOutsideSourceRootsFailureCount: number;
  totalCount: number;
  unknownFailureCount: number;
};

type CapturedFileQueueSql = {
  notFoundFailureCount?: SQL | undefined;
  unknownFailureCount?: SQL | undefined;
};

function fileQueueStatsDatabase(
  input: {
    assetRow?: FileQueueAssetRow;
    captured?: CapturedFileQueueSql;
  } = {}
): Database {
  let selectCount = 0;
  return {
    select(fields?: Record<string, SQL>) {
      selectCount += 1;
      if (selectCount === 1) {
        if (input.captured !== undefined) {
          input.captured.notFoundFailureCount = fields?.notFoundFailureCount;
          input.captured.unknownFailureCount = fields?.unknownFailureCount;
        }
        return {
          from() {
            return Promise.resolve([
              input.assetRow ?? {
                failedCount: 3,
                knownCount: 0,
                missingTdlibFileIdFailureCount: 0,
                notFoundFailureCount: 0,
                readyCount: 0,
                readyDownloadedBytes: 1024,
                staleRetryLimitFailureCount: 0,
                storageIoFailureCount: 0,
                tdlibPathOutsideSourceRootsFailureCount: 2,
                totalCount: 3,
                unknownFailureCount: 1
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
                      oldestDownloadingAgeSeconds: 0,
                      oldestDownloadingUnixSeconds: 0,
                      queuedCount: 0,
                      staleDownloadingCount: 0,
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

function compileCapturedSql(value: SQL | undefined) {
  if (value === undefined) {
    throw new Error('Expected captured SQL expression');
  }
  return new PgDialect().sqlToQuery(value);
}
