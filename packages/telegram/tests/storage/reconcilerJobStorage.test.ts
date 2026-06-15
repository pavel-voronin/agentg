import { describe, expect, it } from 'vitest';

import type { Database } from '../../src/database/client.js';
import type { GetMessagesInput } from '../../src/procedures/get-messages/contract.js';
import {
  claimNextHistoryJob,
  deferHistoryJob,
  enqueueHistoryJob,
  readNextHistoryJobRunAt,
  releaseHistoryJob
} from '../../src/storage/reconcilerJobStorage.js';

describe('History reconciler jobs', () => {
  it('coalesces a duplicate demand that loses the request id insert race', async () => {
    const demand = input();
    const database = enqueueDatabase({
      insertRows: [[]],
      selectRows: [[], [{ status: 'queued' }]]
    });

    const result = await enqueueHistoryJob(database, demand);

    expect(result).toEqual({
      requestId: demand.requestId,
      result: 'pending_coalesced'
    });
    expect(database.insertCount()).toBe(1);
    expect(database.updateValues()).toHaveLength(1);
    expect(database.updateValues()[0]).toHaveProperty('updatedAt');
  });

  it('enqueues a new demand when the insert wins', async () => {
    const demand = input();
    const database = enqueueDatabase({
      insertRows: [[{ requestId: 'request-a' }]],
      selectRows: [[]]
    });

    const result = await enqueueHistoryJob(database, demand);

    expect(result).toEqual({
      requestId: demand.requestId,
      result: 'pending_enqueued'
    });
    expect(database.insertCount()).toBe(1);
    expect(database.updateValues()).toEqual([]);
  });

  it('coalesces overlapping active range work for the same owner', async () => {
    const demand = rangeInput({
      endAt: '2026-06-15T06:41:17.000Z',
      requestId: 'new-range',
      startAt: '2026-06-15T06:11:17.000Z'
    });
    const now = new Date('2026-06-15T06:41:20.000Z');
    const database = enqueueDatabase({
      insertRows: [],
      selectRows: [
        [],
        [
          {
            requestId: 'existing-range',
            selector: {
              endAt: '2026-06-15T06:20:22.000Z',
              kind: 'range',
              startAt: '2026-06-15T05:50:22.000Z'
            }
          }
        ]
      ]
    });

    const result = await enqueueHistoryJob(database, demand, now);

    expect(result).toEqual({
      requestId: 'existing-range',
      result: 'pending_coalesced'
    });
    expect(database.insertCount()).toBe(0);
    expect(database.updateValues()[0]).toMatchObject({
      attemptCount: 0,
      lastFailureReason: null,
      lockedAt: null,
      nextRunAt: now,
      selector: {
        endAt: '2026-06-15T06:41:17.000Z',
        kind: 'range',
        startAt: '2026-06-15T05:50:22.000Z'
      },
      selectorKind: 'range',
      status: 'queued'
    });
  });

  it('does not consume retry attempts when claiming runnable work', async () => {
    const database = claimDatabase();

    await claimNextHistoryJob(database, {
      lockTimeoutMs: 60_000,
      now: new Date('2026-06-12T00:00:00.000Z')
    });

    expect(database.updateValues()[0]).not.toHaveProperty('attemptCount');
  });

  it('increments retry attempts only when deferring and resets them on release', async () => {
    const database = updateOnlyDatabase();

    await deferHistoryJob(database, {
      nextRunAt: new Date('2026-06-12T00:00:30.000Z'),
      requestId: 'request-a'
    });
    await releaseHistoryJob(database, 'request-a', new Date('2026-06-12T00:00:00.000Z'));

    expect(database.updateValues()[0]).toHaveProperty('attemptCount');
    expect(database.updateValues()[1]).toMatchObject({
      attemptCount: 0,
      status: 'queued'
    });
  });

  it('schedules non-stale running jobs at their stale claim time', async () => {
    const database = nextRunAtDatabase([
      {
        lockedAt: new Date('2026-06-12T00:00:00.000Z'),
        nextRunAt: new Date('2026-06-12T00:00:00.000Z'),
        status: 'running'
      },
      {
        lockedAt: null,
        nextRunAt: new Date('2026-06-12T00:10:00.000Z'),
        status: 'deferred'
      }
    ]);

    await expect(readNextHistoryJobRunAt(database, { lockTimeoutMs: 300_000 })).resolves.toEqual(
      new Date('2026-06-12T00:05:00.000Z')
    );
  });
});

type Row = {
  requestId?: string;
  selector?: unknown;
  status?: string;
};

type TestDatabase = Database & {
  insertCount(): number;
  updateValues(): unknown[];
};

function enqueueDatabase(input: { insertRows: Row[][]; selectRows: Row[][] }): TestDatabase {
  let insertCount = 0;
  const updates: unknown[] = [];
  const insertRows = [...input.insertRows];
  const selectRows = [...input.selectRows];

  return {
    insertCount() {
      return insertCount;
    },
    updateValues() {
      return updates;
    },
    insert() {
      insertCount += 1;
      return {
        values() {
          return {
            onConflictDoNothing() {
              return {
                returning() {
                  return Promise.resolve(insertRows.shift() ?? []);
                }
              };
            }
          };
        }
      };
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  return Promise.resolve(selectRows.shift() ?? []);
                }
              };
            }
          };
        }
      };
    },
    update() {
      return {
        set(value: unknown) {
          updates.push(value);
          return {
            where() {
              return Promise.resolve([]);
            }
          };
        }
      };
    }
  } as unknown as TestDatabase;
}

function claimDatabase(): TestDatabase {
  const updates: unknown[] = [];

  return {
    insertCount() {
      return 0;
    },
    updateValues() {
      return updates;
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                orderBy() {
                  return {
                    limit() {
                      return Promise.resolve([{ requestId: 'request-a' }]);
                    }
                  };
                }
              };
            }
          };
        }
      };
    },
    update() {
      return {
        set(value: unknown) {
          updates.push(value);
          return {
            where() {
              return {
                returning() {
                  return Promise.resolve([
                    {
                      attemptCount: 0,
                      createdAt: new Date('2026-06-12T00:00:00.000Z'),
                      lockedAt: new Date('2026-06-12T00:00:00.000Z'),
                      nextRunAt: new Date('2026-06-12T00:00:00.000Z'),
                      owner: input().owner,
                      ownerKind: 'chat',
                      ownerKey: 'chat:123',
                      requestId: 'request-a',
                      selector: input().selector,
                      status: 'running',
                      updatedAt: new Date('2026-06-12T00:00:00.000Z')
                    }
                  ]);
                }
              };
            }
          };
        }
      };
    }
  } as unknown as TestDatabase;
}

function updateOnlyDatabase(): TestDatabase {
  const updates: unknown[] = [];
  return {
    insertCount() {
      return 0;
    },
    updateValues() {
      return updates;
    },
    update() {
      return {
        set(value: unknown) {
          updates.push(value);
          return {
            where() {
              return Promise.resolve([]);
            }
          };
        }
      };
    }
  } as unknown as TestDatabase;
}

function nextRunAtDatabase(rows: unknown[]): Database {
  return {
    select() {
      return {
        from() {
          return {
            where() {
              return Promise.resolve(rows);
            }
          };
        }
      };
    }
  } as unknown as Database;
}

function input(): GetMessagesInput & { requestId: string } {
  return {
    owner: {
      chatId: '123',
      kind: 'chat'
    },
    requestId: 'telegram.getMessages;owner=chat:123;selector=page;anchor=latest;count=100',
    selector: {
      count: 100,
      kind: 'page'
    }
  };
}

function rangeInput(input: {
  endAt: string;
  requestId: string;
  startAt: string;
}): GetMessagesInput & { requestId: string } {
  return {
    owner: {
      chatId: '123',
      kind: 'chat'
    },
    requestId: input.requestId,
    selector: {
      endAt: input.endAt,
      kind: 'range',
      startAt: input.startAt
    }
  };
}
