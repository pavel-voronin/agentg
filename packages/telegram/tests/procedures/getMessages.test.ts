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

import { listHistoryCoverage } from '../../src/history/coverage.js';
import { fetchHistoryPage } from '../../src/history/fetch.js';
import { HISTORY_PAST_BOUNDARY } from '../../src/history/time.js';
import { getMessagesProcedure } from '../../src/procedures/getMessages.js';
import type { ProcedureResources } from '../../src/procedures/resources.js';
import { toReadMessages, type MessageStorageRow } from '../../src/views/message.js';

vi.mock('../../src/history/coverage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/history/coverage.js')>();
  return {
    ...actual,
    listHistoryCoverage: vi.fn()
  };
});

vi.mock('../../src/history/fetch.js', () => ({
  fetchHistoryPage: vi.fn(() => Promise.resolve(undefined))
}));

vi.mock('../../src/views/message.js', () => ({
  readMessageSelection: vi.fn(() => ({
    messageDate: 'messageDate',
    telegramMessageId: 'telegramMessageId'
  })),
  toReadMessages: vi.fn((_database: unknown, messages: MessageStorageRow[]) =>
    Promise.resolve(messages.map(readMessage))
  )
}));

describe('Telegram getMessages procedure', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T14:00:00.100Z'));
    vi.mocked(listHistoryCoverage).mockReset();
    vi.mocked(fetchHistoryPage).mockResolvedValue({
      fetchedMessages: 0,
      kind: 'no_messages_before_end',
      storedMessages: 0
    });
    vi.mocked(toReadMessages).mockImplementation((_database, messages) =>
      Promise.resolve(messages.map(readMessage))
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns a ready full page only when coverage proves the live top gap', async () => {
    const newest = storedMessage('102', '2026-05-01T13:50:00.000Z');
    const oldest = storedMessage('101', '2026-05-01T13:00:00.000Z');
    const rows = [newest, oldest];
    vi.mocked(listHistoryCoverage).mockResolvedValue([
      coverage('2026-05-01T13:00:01.000Z', '2026-05-01T13:50:01.000Z'),
      coverage('2026-05-01T13:50:01.000Z', '2026-05-01T14:00:01.000Z')
    ]);

    const output = await procedure({
      persistedRows: [rows]
    })({
      chatId,
      limit: 2
    });

    expect(output).toEqual({
      messages: [readMessage(oldest), readMessage(newest)],
      reachedStart: false
    });
    expect(fetchHistoryPage).not.toHaveBeenCalled();
    expectStageTelemetry(['resolve_request', 'read_ready']);
  });

  it('materializes a missing current page with the default maximum limit', async () => {
    vi.mocked(listHistoryCoverage)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        coverage(HISTORY_PAST_BOUNDARY.toISOString(), '2026-05-01T14:00:01.000Z')
      ]);

    const output = await procedure({
      persistedRows: [[], []]
    })({
      chatId,
      limit: 150
    });

    expect(output).toEqual({
      messages: [],
      reachedStart: true
    });
    expect(fetchHistoryPage).toHaveBeenCalledWith(
      {
        chatId,
        endAt: '2026-05-01T14:00:01.000Z',
        limit: 100,
        startAt: HISTORY_PAST_BOUNDARY.toISOString()
      },
      expect.anything(),
      { priority: 8 }
    );
    expect(toReadMessages).toHaveBeenCalledTimes(1);
    expectStageTelemetry(['resolve_request', 'read_ready', 'materialize', 'read_materialized']);
  });

  it('uses the default limit when the request omits a limit', async () => {
    vi.mocked(listHistoryCoverage)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        coverage(HISTORY_PAST_BOUNDARY.toISOString(), '2026-05-01T14:00:01.000Z')
      ]);

    await procedure({
      persistedRows: [[], []]
    })({
      chatId
    });

    expect(fetchHistoryPage).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 100
      }),
      expect.anything(),
      { priority: 8 }
    );
  });

  it('uses the cursor message date as the page end and materializes before that cursor', async () => {
    vi.mocked(listHistoryCoverage)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        coverage(HISTORY_PAST_BOUNDARY.toISOString(), '2026-05-01T12:00:01.000Z')
      ]);

    const output = await procedure({
      pageEndRows: [[{ messageDate: new Date('2026-05-01T12:00:00.000Z') }]],
      persistedRows: [[], []]
    })({
      beforeMessageId: '200',
      chatId,
      limit: 25
    });

    expect(output).toEqual({
      messages: [],
      reachedStart: true
    });
    expect(fetchHistoryPage).toHaveBeenCalledWith(
      {
        chatId,
        cursorMessageId: 200,
        endAt: '2026-05-01T12:00:01.000Z',
        limit: 25,
        startAt: HISTORY_PAST_BOUNDARY.toISOString()
      },
      expect.anything(),
      { priority: 8 }
    );
  });

  it('rejects a cursor message that is not stored', async () => {
    vi.mocked(listHistoryCoverage).mockResolvedValue([
      coverage(HISTORY_PAST_BOUNDARY.toISOString(), '2026-05-01T14:00:01.000Z')
    ]);

    await expect(
      procedure({
        pageEndRows: [[]],
        persistedRows: [[]]
      })({
        beforeMessageId: '200',
        chatId,
        limit: 25
      })
    ).rejects.toThrow('telegram.getMessages cursor message is not available: 200');
    expect(fetchHistoryPage).not.toHaveBeenCalled();
  });

  it('rejects an unsafe numeric cursor instead of sending it to materialization', async () => {
    vi.mocked(listHistoryCoverage)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        coverage(HISTORY_PAST_BOUNDARY.toISOString(), '2026-05-01T14:00:01.000Z')
      ]);

    await expect(
      procedure({
        persistedRows: [[], []]
      })({
        beforeMessageId: '9007199254740992',
        chatId,
        limit: 25
      })
    ).rejects.toThrow('telegram.getMessages cursor message id is not safe: 9007199254740992');
    expect(fetchHistoryPage).not.toHaveBeenCalled();
  });

  it('materializes a same-second full page before returning it', async () => {
    const row = storedMessage('101', '2026-05-01T12:00:00.000Z');
    vi.mocked(fetchHistoryPage).mockResolvedValueOnce({
      crossedStart: false,
      fetchedMessages: 1,
      kind: 'page',
      nextCursorMessageId: 101,
      oldestFetchedMessageDate: '2026-05-01T12:00:00.000Z',
      reachedBeginning: false,
      storedMessages: 1
    });
    vi.mocked(listHistoryCoverage).mockResolvedValue([]);

    const output = await procedure({
      pageEndRows: [[{ messageDate: new Date('2026-05-01T12:00:00.000Z') }]],
      persistedRows: [[row], [row]]
    })({
      beforeMessageId: '200',
      chatId,
      limit: 1
    });

    expect(output).toEqual({
      messages: [readMessage(row)],
      reachedStart: false
    });
    expect(fetchHistoryPage).toHaveBeenCalledTimes(1);
    expect(toReadMessages).toHaveBeenCalledTimes(1);
  });

  it('fails when materialization still leaves the page boundary undated', async () => {
    vi.mocked(listHistoryCoverage).mockResolvedValue([]);

    await expect(
      procedure({
        persistedRows: [[storedMessage('101', null)], [storedMessage('101', null)]]
      })({
        chatId,
        limit: 2
      })
    ).rejects.toThrow('telegram.getMessages materialized page is not ready');
    expect(fetchHistoryPage).toHaveBeenCalledTimes(1);
  });

  it('fails when materialization still leaves the oldest full-page message undated', async () => {
    vi.mocked(listHistoryCoverage).mockResolvedValue([]);

    await expect(
      procedure({
        persistedRows: [[undatedStoredMessage('101')], [undatedStoredMessage('101')]]
      })({
        chatId,
        limit: 1
      })
    ).rejects.toThrow('telegram.getMessages materialized page is not ready');
    expect(fetchHistoryPage).toHaveBeenCalledTimes(1);
  });
});

const chatId = '123';

type PageEndRow = {
  messageDate: Date | null;
};

type FakeDatabaseInput = {
  pageEndRows?: PageEndRow[][] | undefined;
  persistedRows: MessageStorageRow[][];
};

function procedure(input: FakeDatabaseInput) {
  return getMessagesProcedure({
    database: fakeDatabase(input),
    events: {},
    files: {},
    tdlib: {}
  } as ProcedureResources);
}

function expectStageTelemetry(stages: string[]) {
  expect(telemetry.timeTelemetrySpan.mock.calls.map(([input]) => input)).toEqual(
    stages.map((stage) => ({
      attributes: {
        'telegram.get_messages.stage': stage
      },
      metric: {
        attributes: {
          'telegram.get_messages.stage': stage
        },
        name: 'telegram.get_messages.stage.duration'
      },
      name: `telegram.get_messages.${stage}`
    }))
  );
  expect(JSON.stringify(telemetry.timeTelemetrySpan.mock.calls)).not.toContain(chatId);
}

function fakeDatabase(input: FakeDatabaseInput): ProcedureResources['database'] {
  const pageEndRows = [...(input.pageEndRows ?? [])];
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
                    limit(limit: number) {
                      return Promise.resolve((persistedRows.shift() ?? []).slice(0, limit));
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

function coverage(startAt: string, endAt: string) {
  return {
    chatId,
    coveredAt: new Date(endAt),
    endAt: new Date(endAt),
    startAt: new Date(startAt)
  };
}

function storedMessage(telegramMessageId: string, messageDate: Date | string | null) {
  return {
    contentType: 'messageText',
    deletedAt: null,
    editDate: null,
    isDeleted: false,
    isOutgoing: false,
    messageDate: typeof messageDate === 'string' ? new Date(messageDate) : messageDate,
    reactions: null,
    replyTo: null,
    senderId: null,
    senderType: null,
    telegramChatId: chatId,
    telegramMessageId,
    text: `message-${telegramMessageId}`,
    textEntities: null
  };
}

function undatedStoredMessage(telegramMessageId: string): MessageStorageRow {
  const row = storedMessage(telegramMessageId, null) as Omit<MessageStorageRow, 'messageDate'> &
    Partial<Pick<MessageStorageRow, 'messageDate'>>;
  delete row.messageDate;
  return row as MessageStorageRow;
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
    isDeleted: message.isDeleted,
    isOutgoing: message.isOutgoing,
    media: {
      files: []
    },
    messageDate: message.messageDate == null ? null : new Date(message.messageDate).toISOString(),
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
