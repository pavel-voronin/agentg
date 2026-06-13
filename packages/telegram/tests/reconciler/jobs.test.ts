import { describe, expect, it } from 'vitest';

import type { Database } from '../../src/database/client.js';
import type { GetMessagesInput } from '../../src/procedures/get-messages/contract.js';
import {
  claimNextHistoryJob,
  deferHistoryJob,
  enqueueHistoryJob,
  releaseHistoryJob
} from '../../src/reconciler/jobs.js';

describe('History reconciler jobs', () => {
  it('coalesces a duplicate demand that loses the request id insert race', async () => {
    const database = enqueueDatabase({
      insertRows: [[]],
      selectRows: [[], [{ status: 'queued' }]]
    });

    const result = await enqueueHistoryJob(database, input());

    expect(result).toBe('pending_coalesced');
    expect(database.insertCount()).toBe(1);
    expect(database.updateValues()).toHaveLength(1);
    expect(database.updateValues()[0]).toHaveProperty('updatedAt');
  });

  it('enqueues a new demand when the insert wins', async () => {
    const database = enqueueDatabase({
      insertRows: [[{ requestId: 'request-a' }]],
      selectRows: [[]]
    });

    const result = await enqueueHistoryJob(database, input());

    expect(result).toBe('pending_enqueued');
    expect(database.insertCount()).toBe(1);
    expect(database.updateValues()).toEqual([]);
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
});

type Row = {
  requestId?: string;
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
