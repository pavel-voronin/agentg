import { describe, expect, it } from 'vitest';

import type { Database } from '../src/database/client.js';
import { chatRef } from '../src/model/refs.js';
import { procedures } from '../dashboard/backend/procedures.js';
import { requestFileSlot } from '../src/files/request.js';
import type { FileSubsystemOptions } from '../src/files/runtime.js';
import type { FileOwner } from '../src/files/types.js';
import { requestFileProcedure } from '../src/procedures/requestFile.js';
import type { ProcedureResources } from '../src/procedures/resources.js';

describe('Telegram file request', () => {
  it('publishes a queue wake event even when an explicit request finds an existing job', async () => {
    const events: { data?: unknown; type: string }[] = [];

    await requestFileSlot(
      requestOptions({
        database: existingQueuedJobDatabase(),
        events
      }),
      {
        owner: chatRef('chat-1'),
        slotKey: 'photo.main'
      }
    );

    expect(events.map((event) => event.type)).toContain('telegram.files.ownerChanged');
    expect(
      events.find((event) => event.type === 'telegram.files.ownerChanged')?.data
    ).toMatchObject({
      files: [
        {
          owner: {
            _model: 'telegram.chat',
            id: 'chat-1'
          },
          slotKey: 'photo.main',
          status: 'queued'
        }
      ],
      owner: {
        ownerId: 'chat-1',
        ownerModel: 'telegram.chat'
      }
    });
    const queueEvent = events.find((event) => event.type === 'telegram.files.queueChanged');
    expect(queueEvent?.data).toMatchObject({
      queuedCount: 1
    });
  });

  it('exposes the domain request path from the Telegram procedure', async () => {
    const events: { data?: unknown; type: string }[] = [];
    const rpc = requestFileProcedure(procedureResources(events));

    const result = await rpc({
      owner: chatRef('chat-1'),
      slotKey: 'photo.main'
    });

    expect(result.decision.action).toBe('enqueue');
    expect(events.map((event) => event.type)).toContain('telegram.files.ownerChanged');
    expect(
      events.find((event) => event.type === 'telegram.files.ownerChanged')?.data
    ).toMatchObject({
      files: [
        {
          owner: {
            _model: 'telegram.chat',
            id: 'chat-1'
          },
          slotKey: 'photo.main',
          status: 'queued'
        }
      ],
      owner: {
        ownerId: 'chat-1',
        ownerModel: 'telegram.chat'
      }
    });
    const queueEvent = events.find((event) => event.type === 'telegram.files.queueChanged');
    expect(queueEvent?.data).toMatchObject({
      queuedCount: 1
    });
  });

  it('proxies the Dashboard procedure to the Telegram procedure', async () => {
    const events: { data?: unknown; type: string }[] = [];
    const calls: { input: unknown; procedure: string }[] = [];
    const output = {
      decision: {
        action: 'enqueue',
        reason: 'file download was enqueued'
      },
      file: null
    };
    const rpc = procedures({
      callTelegramProcedure<T>(procedure: string, input: unknown): Promise<T> {
        calls.push({ input, procedure });
        return Promise.resolve(output as T);
      },
      database: existingQueuedJobDatabase(),
      events: eventSink(events)
    });

    const input = {
      owner: chatRef('chat-1'),
      slotKey: 'photo.main'
    };
    const result = await rpc['telegram.dashboard.requestFile'](input);

    expect(result).toEqual(output);
    expect(calls).toEqual([
      {
        input,
        procedure: 'requestFile'
      }
    ]);
    expect(events).toEqual([]);
  });
});

function requestOptions(input: {
  database: Database;
  events: { data?: unknown; type: string }[];
}): FileSubsystemOptions {
  return {
    database: input.database,
    events: {
      publish(type: string, data?: unknown) {
        input.events.push({ data, type });
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
    tdlib: {
      getQueueStats() {
        return {
          highestPendingPriority: null,
          pendingCount: 0,
          runningCount: 0
        };
      }
    }
  } as unknown as FileSubsystemOptions;
}

function procedureResources(events: { data?: unknown; type: string }[]): ProcedureResources {
  return {
    database: existingQueuedJobDatabase(),
    events: eventSink(events),
    files: {
      requestFile(input: { owner: FileOwner; slotKey: string }) {
        return requestFileSlot(
          requestOptions({
            database: existingQueuedJobDatabase(),
            events
          }),
          input
        );
      }
    },
    tdlib: {}
  } as unknown as ProcedureResources;
}

function eventSink(events: { data?: unknown; type: string }[]): FileSubsystemOptions['events'] {
  return {
    publish(type: string, data?: unknown) {
      events.push({ data, type });
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
  };
}

function existingQueuedJobDatabase(): Database {
  let selectCount = 0;
  return {
    insert() {
      return {
        values() {
          return {
            onConflictDoUpdate() {
              return {
                returning() {
                  return Promise.resolve([]);
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
        return requestRowSelect();
      }
      if (selectCount === 2) {
        return fileRefSelect();
      }
      if (selectCount === 3) {
        return assetStatsSelect();
      }
      if (selectCount === 4) {
        return jobStatsSelect();
      }
      return fileRefSelect();
    }
  } as unknown as Database;
}

function requestRowSelect() {
  return {
    from() {
      return {
        innerJoin() {
          return {
            leftJoin() {
              return {
                where() {
                  return {
                    limit() {
                      return Promise.resolve([
                        {
                          assetKey: 'telegram:asset-a',
                          assetStatus: 'known',
                          byteSize: 100,
                          jobStatus: 'queued',
                          mediaKind: 'photo'
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

function assetStatsSelect() {
  return {
    from() {
      return Promise.resolve([
        {
          failedCount: 0,
          knownCount: 1,
          readyCount: 0,
          totalCount: 1
        }
      ]);
    }
  };
}

function jobStatsSelect() {
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
                  knownRemainingBytes: 100,
                  knownTotalBytes: 100,
                  oldestDownloadingAgeSeconds: 0,
                  queuedCount: 1,
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

function fileRefSelect() {
  const now = new Date('2026-06-09T00:00:00.000Z');
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
                      assetDownloadedByteSize: 0,
                      assetKey: 'telegram:asset-a',
                      assetRelativePath: null,
                      assetStatus: 'known',
                      assetUpdatedAt: now,
                      byteSize: 100,
                      durationSeconds: null,
                      fileName: 'photo.jpg',
                      height: null,
                      jobStatus: 'queued',
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
