import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { file } from 'tdlib-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { recordTelemetryHistogram } from '@agentg/framework';

import type { Database } from '../src/database/client.js';
import { ACTIVE_NOTIFICATION_MODEL } from '../src/model/refs.js';
import { handleFileSnapshot, recordFileSlotUpdate } from '../src/files/persistence.js';
import type { FileSubsystemOptions } from '../src/files/runtime.js';

vi.mock('@agentg/framework', () => ({
  recordTelemetryHistogram: vi.fn()
}));

describe('Telegram file persistence', () => {
  beforeEach(() => {
    vi.mocked(recordTelemetryHistogram).mockClear();
  });

  it('matches progress file snapshots by asset key, TDLib file id, and byte progress', async () => {
    const captured: { snapshotCondition?: SQL } = {};
    const database = snapshotDatabase((condition) => {
      captured.snapshotCondition = condition;
    });

    await handleFileSnapshot(
      database,
      tdlibFile({
        completed: false,
        downloadedSize: 50,
        id: 10,
        uniqueId: 'asset-b'
      })
    );

    const snapshotCondition = captured.snapshotCondition;
    if (snapshotCondition === undefined) {
      throw new Error('Snapshot condition was not captured');
    }
    const query = new PgDialect().sqlToQuery(snapshotCondition);
    expect(query.sql).toContain('"telegram_file_assets"."asset_key" = $1');
    expect(query.sql).toContain('"telegram_file_assets"."latest_tdlib_file_id" = $2');
    expect(query.sql).toContain(
      '"telegram_file_assets"."downloaded_byte_size" is distinct from $3'
    );
    expect(query.params).toEqual(['telegram:asset-b', 10, 50]);
  });

  it('keeps completed file snapshots eligible when byte progress did not change', async () => {
    const captured: { snapshotCondition?: SQL } = {};
    const database = snapshotDatabase((condition) => {
      captured.snapshotCondition = condition;
    });

    await handleFileSnapshot(database, tdlibFile({ id: 10, uniqueId: 'asset-b' }));

    const snapshotCondition = captured.snapshotCondition;
    if (snapshotCondition === undefined) {
      throw new Error('Snapshot condition was not captured');
    }
    const query = new PgDialect().sqlToQuery(snapshotCondition);
    expect(query.sql).toContain('"telegram_file_assets"."asset_key" = $1');
    expect(query.sql).toContain('"telegram_file_assets"."latest_tdlib_file_id" = $2');
    expect(query.sql).not.toContain('"telegram_file_assets"."downloaded_byte_size" is distinct');
    expect(query.params).toEqual(['telegram:asset-b', 10]);
  });

  it('does not prune active notification slots for incremental notification file updates', async () => {
    const captured: SQL[] = [];

    await recordFileSlotUpdate(
      fileSlotUpdateOptions((condition) => {
        captured.push(condition);
      }),
      {
        notificationGroups: {
          groups: []
        }
      },
      'live_update'
    );

    expect(captured).toEqual([]);
  });

  it('prunes active notification slots for full active notification snapshots', async () => {
    const captured: SQL[] = [];

    await recordFileSlotUpdate(
      fileSlotUpdateOptions((condition) => {
        captured.push(condition);
      }),
      {
        notificationGroups: {
          groups: []
        }
      },
      'live_update',
      undefined,
      {
        pruneStaleActiveNotificationSlots: true
      }
    );

    expect(captured).toHaveLength(1);
    const condition = captured[0];
    if (condition === undefined) {
      throw new Error('Delete condition was not captured');
    }
    const query = new PgDialect().sqlToQuery(condition);
    expect(query.sql).toContain('"telegram_file_slots"."owner_model" = $1');
    expect(query.params).toEqual([ACTIVE_NOTIFICATION_MODEL]);
  });

  it('records file slot stages as aggregate metrics', async () => {
    await recordFileSlotUpdate(
      fileSlotUpdateOptions(() => undefined),
      {
        notificationGroups: {
          groups: []
        }
      },
      'live_update',
      undefined,
      {
        pruneStaleActiveNotificationSlots: true
      }
    );

    expect(recordTelemetryHistogram).toHaveBeenCalledWith(
      'telegram.file.record.stage.duration',
      expect.any(Number),
      {
        'telegram.file.owner_model': 'telegram.active_notification',
        'telegram.file.record.cause': 'live_update',
        'telegram.file.record.stage': 'prune_stale_slots'
      },
      { unit: 's' }
    );
  });
});

function snapshotDatabase(captureCondition: (condition: SQL) => void): Database {
  return {
    insert() {
      return {
        values() {
          return {
            onConflictDoUpdate() {
              return Promise.resolve();
            }
          };
        }
      };
    },
    update() {
      return {
        set() {
          return {
            where(condition: SQL) {
              captureCondition(condition);
              return {
                returning() {
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

function fileSlotUpdateOptions(
  captureDeleteCondition: (condition: SQL) => void
): FileSubsystemOptions {
  const database = {
    delete() {
      return {
        where(condition: SQL) {
          captureDeleteCondition(condition);
          return Promise.resolve([]);
        }
      };
    }
  } as unknown as Database;

  return {
    database,
    events: {
      publish() {
        return undefined;
      },
      subscribe() {
        return Promise.resolve(() => undefined);
      }
    },
    filesDirectory: '/tmp/agentg-test-files',
    getDownloadRules() {
      return [];
    },
    tdlib: {
      getQueueStats() {
        return {
          highestPendingPriority: null,
          runningCount: 0
        };
      }
    }
  } as unknown as FileSubsystemOptions;
}

function tdlibFile(input: {
  completed?: boolean;
  downloadedSize?: number;
  id: number;
  uniqueId: string;
}): file {
  const completed = input.completed ?? true;
  const downloadedSize = input.downloadedSize ?? 100;
  return {
    _: 'file',
    expected_size: 100,
    id: input.id,
    local: {
      _: 'localFile',
      can_be_deleted: true,
      can_be_downloaded: true,
      download_offset: 0,
      downloaded_prefix_size: downloadedSize,
      downloaded_size: downloadedSize,
      is_downloading_active: false,
      is_downloading_completed: completed,
      path: completed ? '/tmp/asset' : ''
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
