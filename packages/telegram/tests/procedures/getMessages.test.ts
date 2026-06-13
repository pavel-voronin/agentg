import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const telemetry = vi.hoisted(() => ({
  timeTelemetrySpan: vi.fn(
    async (_input: unknown, operation: () => Promise<unknown>): Promise<unknown> => operation()
  )
}));

vi.mock('@agentg/framework', async (importOriginal) => {
  const framework = await importOriginal<typeof import('@agentg/framework')>();
  return {
    ...framework,
    timeTelemetrySpan: telemetry.timeTelemetrySpan
  };
});

vi.mock('../../src/reconciler/coverage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/reconciler/coverage.js')>();
  return {
    ...actual,
    isOwnerCovered: vi.fn(() => Promise.resolve(true)),
    listOwnerCoverage: vi.fn(() => Promise.resolve([])),
    missingOwnerCoverageIntervals: vi.fn(() => Promise.resolve([]))
  };
});

vi.mock('../../src/views/message.js', () => ({
  readMessageSelection: vi.fn(() => ({
    messageDate: 'messageDate',
    telegramMessageId: 'telegramMessageId'
  })),
  toReadMessages: vi.fn((_database: unknown, messages: MessageStorageRow[]) =>
    Promise.resolve(messages.map(readMessage))
  )
}));

import {
  isOwnerCovered,
  listOwnerCoverage,
  missingOwnerCoverageIntervals
} from '../../src/reconciler/coverage.js';
import { getMessagesProcedure } from '../../src/procedures/getMessages.js';
import type { ProcedureResources } from '../../src/procedures/resources.js';
import type { MessageStorageRow } from '../../src/views/message.js';
import { toReadMessages } from '../../src/views/message.js';

describe('Telegram getMessages procedure', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T14:00:00.100Z'));
    vi.mocked(isOwnerCovered).mockResolvedValue(true);
    vi.mocked(listOwnerCoverage).mockResolvedValue([]);
    vi.mocked(missingOwnerCoverageIntervals).mockResolvedValue([]);
    vi.mocked(toReadMessages).mockImplementation((_database, messages) =>
      Promise.resolve(messages.map(readMessage))
    );
    telemetry.timeTelemetrySpan.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns a ready page when owner coverage proves the local page', async () => {
    const newest = storedMessage('102', '2026-05-01T13:50:00.000Z');
    const oldest = storedMessage('101', '2026-05-01T13:00:00.000Z');

    const output = await procedure({
      persistedRows: [[newest, oldest]]
    })({
      owner: {
        chatId,
        kind: 'chat'
      },
      selector: {
        count: 2,
        kind: 'page'
      }
    });

    expect(output).toEqual({
      messages: [readMessage(oldest), readMessage(newest)],
      reachedStart: false,
      status: 'ready'
    });
    expect(toReadMessages).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(telemetry.timeTelemetrySpan.mock.calls)).not.toContain(chatId);
  });

  it('returns a ready empty latest page when owner coverage proves empty history', async () => {
    const reconciler = fakeReconciler('pending_enqueued');
    vi.mocked(listOwnerCoverage).mockResolvedValue([
      {
        coveredAt: new Date('2026-05-01T14:00:01.000Z'),
        endAt: new Date('2026-05-01T14:00:01.000Z'),
        ownerKey: 'chat:123',
        ownerKind: 'chat',
        startAt: new Date('2013-08-14T00:00:00.000Z')
      }
    ]);

    const output = await procedure(
      {
        pageEndRows: [[]],
        persistedRows: [[]]
      },
      reconciler
    )({
      owner: {
        chatId,
        kind: 'chat'
      },
      selector: {
        count: 100,
        kind: 'page'
      }
    });

    expect(output).toEqual({
      messages: [],
      reachedStart: true,
      status: 'ready'
    });
    expect(reconciler.enqueue).not.toHaveBeenCalled();
  });

  it('keeps an empty latest page pending until coverage proves empty history', async () => {
    const reconciler = fakeReconciler('pending_enqueued');
    vi.mocked(isOwnerCovered).mockResolvedValue(false);

    const output = await procedure(
      {
        pageEndRows: [[]],
        persistedRows: [[]]
      },
      reconciler
    )({
      owner: {
        chatId,
        kind: 'chat'
      },
      selector: {
        count: 100,
        kind: 'page'
      }
    });

    expect(output).toEqual({
      requestId: 'telegram.getMessages;selector=page;owner=chat:123;anchor=latest;count=100',
      status: 'pending'
    });
    expect(reconciler.enqueue).toHaveBeenCalledTimes(1);
  });

  it('returns a ready empty page before an anchor when coverage proves owner beginning', async () => {
    const reconciler = fakeReconciler('pending_enqueued');

    const output = await procedure(
      {
        pageEndRows: [
          [
            {
              messageDate: new Date('2026-05-01T13:00:00.000Z')
            }
          ]
        ],
        persistedRows: [[]]
      },
      reconciler
    )({
      owner: {
        chatId,
        kind: 'chat'
      },
      selector: {
        beforeMessageId: '200',
        count: 100,
        kind: 'page'
      }
    });

    expect(output).toEqual({
      messages: [],
      reachedStart: true,
      status: 'ready'
    });
    expect(reconciler.enqueue).not.toHaveBeenCalled();
  });

  it('returns a ready range without reachedStart', async () => {
    const first = storedMessage('101', '2026-05-01T13:00:00.000Z');
    const second = storedMessage('102', '2026-05-01T13:50:00.000Z');

    const output = await procedure({
      persistedRows: [[first, second]]
    })({
      owner: {
        chatId,
        kind: 'chat'
      },
      selector: {
        endAt: '2026-05-01T14:00:00.000Z',
        kind: 'range',
        startAt: '2026-05-01T13:00:00.000Z'
      }
    });

    expect(output).toEqual({
      messages: [readMessage(first), readMessage(second)],
      status: 'ready'
    });
    expect('reachedStart' in output).toBe(false);
  });

  it('returns pending without messages when page coverage is missing', async () => {
    vi.mocked(missingOwnerCoverageIntervals).mockResolvedValue([
      {
        endAt: new Date('2026-05-01T14:00:01.000Z'),
        startAt: new Date('2026-05-01T13:00:01.000Z')
      }
    ]);

    const reconciler = fakeReconciler('pending_enqueued');
    const output = await procedure(
      {
        persistedRows: [[storedMessage('101', '2026-05-01T13:00:00.000Z')]]
      },
      reconciler
    )({
      owner: {
        chatId,
        kind: 'chat'
      },
      selector: {
        count: 1,
        kind: 'page'
      }
    });

    expect(output).toEqual({
      requestId: 'telegram.getMessages;selector=page;owner=chat:123;anchor=latest;count=1',
      status: 'pending'
    });
    expect('messages' in output).toBe(false);
    expect(reconciler.enqueue).toHaveBeenCalledWith({
      owner: {
        chatId,
        kind: 'chat'
      },
      requestId: 'telegram.getMessages;selector=page;owner=chat:123;anchor=latest;count=1',
      selector: {
        count: 1,
        kind: 'page'
      }
    });
  });

  it('returns pending instead of rejecting when a page cursor is not local', async () => {
    const reconciler = fakeReconciler('pending_coalesced');

    const output = await procedure(
      {
        pageEndRows: [[]],
        persistedRows: [[]]
      },
      reconciler
    )({
      owner: {
        chatId,
        kind: 'chat'
      },
      selector: {
        beforeMessageId: '200',
        count: 25,
        kind: 'page'
      }
    });

    expect(output).toEqual({
      requestId: 'telegram.getMessages;selector=page;owner=chat:123;beforeMessageId=200;count=25',
      status: 'pending'
    });
  });

  it('returns the same request id for repeated uncovered selectors', async () => {
    vi.mocked(isOwnerCovered).mockResolvedValue(false);
    vi.mocked(missingOwnerCoverageIntervals).mockResolvedValue([
      {
        endAt: new Date('2026-02-01T00:00:00.000Z'),
        startAt: new Date('2026-01-01T00:00:00.000Z')
      }
    ]);
    const reconciler = fakeReconciler('pending_coalesced');
    const input = {
      owner: {
        chatId,
        kind: 'forumTopic' as const,
        topicId: '7'
      },
      selector: {
        endAt: '2026-02-01T00:00:00.000Z',
        kind: 'range' as const,
        startAt: '2026-01-01T00:00:00.000Z'
      }
    };
    const rpc = procedure({ persistedRows: [[], []] }, reconciler);

    const first = await rpc(input);
    const second = await rpc(input);

    expect(first).toEqual(second);
    expect(first).toEqual({
      requestId:
        'telegram.getMessages;selector=range;owner=forum-topic:123:7;startAt=2026-01-01T00:00:00.000Z;endAt=2026-02-01T00:00:00.000Z',
      status: 'pending'
    });
  });

  it('does not call TDLib or files directly', async () => {
    vi.mocked(missingOwnerCoverageIntervals).mockResolvedValue([
      {
        endAt: new Date('2026-05-01T14:00:01.000Z'),
        startAt: new Date('2026-05-01T13:00:01.000Z')
      }
    ]);
    const tdlib = new Proxy(
      {},
      {
        get() {
          throw new Error('TDLib must not be called by getMessages');
        }
      }
    );
    const files = new Proxy(
      {},
      {
        get() {
          throw new Error('Files must not be called by getMessages');
        }
      }
    );

    await expect(
      procedure({
        files,
        persistedRows: [[storedMessage('101', '2026-05-01T13:00:00.000Z')]],
        tdlib
      })({
        owner: {
          chatId,
          kind: 'chat'
        },
        selector: {
          count: 1,
          kind: 'page'
        }
      })
    ).resolves.toMatchObject({
      status: 'pending'
    });
  });
});

const chatId = '123';

type PageEndRow = {
  messageDate: Date | null;
};

type FakeDatabaseInput = {
  files?: unknown;
  pageEndRows?: PageEndRow[][] | undefined;
  persistedRows: MessageStorageRow[][];
  tdlib?: unknown;
};

function procedure(input: FakeDatabaseInput, reconciler = fakeReconciler('pending_enqueued')) {
  return getMessagesProcedure({
    database: fakeDatabase(input),
    events: {},
    files: input.files ?? {},
    reconciler,
    tdlib: input.tdlib ?? {}
  } as unknown as ProcedureResources);
}

function fakeReconciler(result: 'pending_coalesced' | 'pending_enqueued') {
  return {
    enqueue: vi.fn(() => Promise.resolve(result)),
    getStats: vi.fn()
  };
}

function fakeDatabase(input: FakeDatabaseInput): ProcedureResources['database'] {
  const pageEndRows = [
    ...(input.pageEndRows ??
      input.persistedRows.map((rows) => [
        {
          messageDate: newestMessageDate(rows)
        }
      ]))
  ];
  const persistedRows = [...input.persistedRows];

  return {
    select(selection: Record<string, unknown>) {
      if ('messageDate' in selection && !('telegramMessageId' in selection)) {
        return {
          from() {
            return {
              where() {
                return {
                  limit() {
                    return Promise.resolve(pageEndRows.shift() ?? []);
                  },
                  orderBy() {
                    return {
                      limit() {
                        return Promise.resolve(pageEndRows.shift() ?? []);
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
                  const rows = persistedRows.shift() ?? [];
                  return {
                    limit(limit: number) {
                      return Promise.resolve(rows.slice(0, limit));
                    },
                    then(resolve: (rows: MessageStorageRow[]) => unknown) {
                      return Promise.resolve(rows).then(resolve);
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  } as unknown as ProcedureResources['database'];
}

function newestMessageDate(rows: MessageStorageRow[]): Date | null {
  return (
    rows
      .map((row) => row.messageDate)
      .filter((date): date is Date => date instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null
  );
}

function storedMessage(messageId: string, messageDate: string | null): MessageStorageRow {
  return {
    contentType: 'messageText',
    deletedAt: null,
    editDate: null,
    isDeleted: false,
    isOutgoing: false,
    messageDate: messageDate === null ? null : new Date(messageDate),
    reactions: null,
    replyTo: null,
    senderId: null,
    senderType: null,
    telegramChatId: chatId,
    telegramMessageId: messageId,
    text: `message-${messageId}`,
    textEntities: null
  };
}

function readMessage(message: MessageStorageRow) {
  return {
    _model: 'telegram.message' as const,
    chat: {
      _model: 'telegram.chat' as const,
      id: message.telegramChatId
    },
    contentType: message.contentType,
    deletedAt: null,
    editDate: null,
    id: `${message.telegramChatId}:${message.telegramMessageId}`,
    isDeleted: false,
    isOutgoing: false,
    media: {
      files: []
    },
    messageDate: messageDate(message),
    reactions: [],
    replyTo: null,
    sender: null,
    senderDisplayName: null,
    senderType: null,
    serviceAction: null,
    telegramMessageId: message.telegramMessageId,
    text: message.text,
    textEntities: []
  };
}

function messageDate(message: MessageStorageRow): string | null {
  if (message.messageDate instanceof Date) {
    return message.messageDate.toISOString();
  }
  return typeof message.messageDate === 'string' ? message.messageDate : null;
}
