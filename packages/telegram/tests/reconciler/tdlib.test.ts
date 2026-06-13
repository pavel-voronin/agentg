import type { message as Message } from 'tdlib-types';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../../src/database/client.js';
import type { MessageStorageRow } from '../../src/views/message.js';
import type { Operations } from '../../src/tdlib/operations.js';
import { fetchOwnerHistoryStep } from '../../src/reconciler/tdlib.js';

describe('Telegram history reconciler TDLib adapter', () => {
  it('does not prove owner beginning from a non-empty initial zero cursor page', async () => {
    const getForumTopicHistory = vi.fn(() =>
      Promise.resolve({
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
});

function historyDatabase(input?: {
  oldestKnownRows?: { messageId: string }[];
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
    date: Math.floor(new Date(date).getTime() / 1000),
    id
  } as unknown as Message;
}
