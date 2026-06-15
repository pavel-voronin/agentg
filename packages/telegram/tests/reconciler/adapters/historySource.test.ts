import type { message as Message } from 'tdlib-types';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../../../src/database/client.js';
import { fetchOwnerHistoryStep } from '../../../src/reconciler/adapters/historySource.js';
import type { Operations } from '../../../src/tdlib/operations.js';
import type { MessageStorageRow } from '../../../src/storage/messageRowStorage.js';

describe('Telegram history source adapter', () => {
  it('does not prove owner beginning from a non-empty initial zero cursor page', async () => {
    const getForumTopicHistory = vi.fn(() =>
      Promise.resolve({
        total_count: 1,
        messages: [
          message(200, '2026-06-11T23:59:00.000Z'),
          message(199, '2026-06-11T23:58:00.000Z')
        ]
      })
    );

    const result = await fetchOwnerHistoryStep({
      database: historyDatabase(),
      interval: interval('2013-08-14T00:00:00.000Z', '2026-06-12T00:00:00.000Z'),
      owner: {
        chatId: '123',
        kind: 'forumTopic',
        topicId: '7'
      },
      selector: {
        endAt: '2026-06-12T00:00:00.000Z',
        kind: 'range',
        startAt: '2013-08-14T00:00:00.000Z'
      },
      tdlib: {
        getForumTopicHistory
      } as unknown as Operations
    });

    expect(getForumTopicHistory).toHaveBeenCalledWith(
      {
        chatId: 123,
        forumTopicId: 7,
        fromMessageId: 0,
        limit: 100,
        offset: 0
      },
      {
        priority: 8
      }
    );
    expect(result.reachedBeginning).toBe(false);
    expect(result.coverageInterval).toEqual({
      endAt: new Date('2026-06-12T00:00:00.000Z'),
      startAt: new Date('2026-06-11T23:58:01.000Z')
    });
  });

  it('limits non-local beforeMessageId coverage to the returned anchor message date', async () => {
    const getChatHistory = vi.fn(() =>
      Promise.resolve({
        total_count: 500,
        messages: [
          message(200, '2026-05-01T13:00:00.000Z'),
          message(199, '2026-05-01T12:59:00.000Z')
        ]
      })
    );

    const result = await fetchOwnerHistoryStep({
      database: historyDatabase({
        pageRows: []
      }),
      interval: interval('2013-08-14T00:00:00.000Z', '2026-05-01T14:00:01.000Z'),
      owner: {
        chatId: '123',
        kind: 'chat'
      },
      selector: {
        beforeMessageId: '200',
        count: 100,
        kind: 'page'
      },
      tdlib: {
        getChatHistory
      } as unknown as Operations
    });

    expect(getChatHistory).toHaveBeenCalledWith(
      {
        chatId: 123,
        fromMessageId: 200,
        limit: 100,
        offset: 0,
        onlyLocal: false
      },
      {
        priority: 8
      }
    );
    expect(result.coverageInterval).toEqual({
      endAt: new Date('2026-05-01T13:00:01.000Z'),
      startAt: new Date('2026-05-01T12:59:01.000Z')
    });
  });

  it('does not prove beginning from an anchor-only cursor page', async () => {
    const getChatHistory = vi.fn(() =>
      Promise.resolve({
        total_count: 500,
        messages: [message(200, '2026-05-01T13:00:00.000Z')]
      })
    );

    const result = await fetchOwnerHistoryStep({
      database: historyDatabase({
        pageRows: []
      }),
      interval: interval('2013-08-14T00:00:00.000Z', '2026-05-01T14:00:01.000Z'),
      owner: {
        chatId: '123',
        kind: 'chat'
      },
      selector: {
        beforeMessageId: '200',
        count: 100,
        kind: 'page'
      },
      tdlib: {
        getChatHistory
      } as unknown as Operations
    });

    expect(result.reachedBeginning).toBe(false);
    expect(result.coverageInterval).toBeUndefined();
  });

  it('does not prove beginning from TDLib pages containing null placeholders', async () => {
    const getForumTopicHistory = vi.fn(() =>
      Promise.resolve({
        total_count: 0,
        messages: [null]
      })
    );

    const result = await fetchOwnerHistoryStep({
      database: historyDatabase(),
      interval: interval('2013-08-14T00:00:00.000Z', '2026-06-12T00:00:00.000Z'),
      owner: {
        chatId: '123',
        kind: 'forumTopic',
        topicId: '7'
      },
      selector: {
        count: 100,
        kind: 'page'
      },
      tdlib: {
        getForumTopicHistory
      } as unknown as Operations
    });

    expect(result.reachedBeginning).toBe(false);
    expect(result.coverageInterval).toBeUndefined();
  });

  it('clamps no-anchor local cursor coverage to the local cursor message date', async () => {
    const getForumTopicHistory = vi.fn(() =>
      Promise.resolve({
        total_count: 500,
        messages: [
          message(200, '2026-06-11T23:59:00.000Z'),
          message(199, '2026-06-11T23:58:00.000Z')
        ]
      })
    );

    const result = await fetchOwnerHistoryStep({
      database: historyDatabase({
        oldestKnownRows: [
          {
            messageDate: new Date('2026-06-11T23:59:00.000Z'),
            messageId: '200'
          }
        ]
      }),
      interval: interval('2013-08-14T00:00:00.000Z', '2026-06-12T00:00:00.000Z'),
      owner: {
        chatId: '123',
        kind: 'forumTopic',
        topicId: '7'
      },
      selector: {
        endAt: '2026-06-12T00:00:00.000Z',
        kind: 'range',
        startAt: '2013-08-14T00:00:00.000Z'
      },
      tdlib: {
        getForumTopicHistory
      } as unknown as Operations
    });

    expect(result.coverageInterval).toEqual({
      endAt: new Date('2026-06-11T23:59:01.000Z'),
      startAt: new Date('2026-06-11T23:58:01.000Z')
    });
  });

  it('proves empty no-anchor owner history from an empty zero cursor page', async () => {
    const getForumTopicHistory = vi.fn(() =>
      Promise.resolve({
        total_count: 0,
        messages: []
      })
    );

    const result = await fetchOwnerHistoryStep({
      database: historyDatabase(),
      interval: interval('2013-08-14T00:00:00.000Z', '2026-06-12T00:00:00.000Z'),
      owner: {
        chatId: '123',
        kind: 'forumTopic',
        topicId: '7'
      },
      selector: {
        count: 100,
        kind: 'page'
      },
      tdlib: {
        getForumTopicHistory
      } as unknown as Operations
    });

    expect(result).toEqual({
      coverageInterval: {
        endAt: new Date('2026-06-12T00:00:00.000Z'),
        startAt: new Date('2013-08-14T00:00:00.000Z')
      },
      fetchedMessages: [],
      reachedBeginning: true
    });
  });
});

function historyDatabase(input?: {
  oldestKnownRows?: { messageDate?: Date | null; messageId: string }[];
  pageRows?: Pick<MessageStorageRow, 'telegramMessageId'>[];
}): Database {
  return {
    select(selection: Record<string, unknown>) {
      const rows =
        'messageId' in selection ? (input?.oldestKnownRows ?? []) : (input?.pageRows ?? []);
      return {
        from() {
          return {
            where() {
              return {
                orderBy() {
                  return {
                    limit() {
                      return Promise.resolve(rows);
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

function interval(startAt: string, endAt: string) {
  return {
    endAt: new Date(endAt),
    startAt: new Date(startAt)
  };
}

function message(id: number, date: string): Message {
  return {
    _: 'message',
    chat_id: 123,
    content: {
      _: 'messageText',
      text: {
        _: 'formattedText',
        entities: [],
        text: `message-${String(id)}`
      }
    },
    date: Math.floor(new Date(date).getTime() / 1000),
    id,
    is_outgoing: false,
    sender_id: {
      _: 'messageSenderUser',
      user_id: 30
    }
  } as unknown as Message;
}
