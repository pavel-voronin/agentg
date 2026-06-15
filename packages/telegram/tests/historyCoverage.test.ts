import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import type { Database } from '../src/database/client.js';
import {
  listHistoryChats,
  normalizeCoverageSegments,
  planHistoryCoverageMerge,
  subtractHistoryIntervals
} from '../src/history/coverage.js';

describe('Telegram history coverage', () => {
  it('keeps operational coverage compact and takes the latest covered timestamp', () => {
    expect(
      normalizeCoverageSegments([
        coverage('chat-a', '2026-05-01T00:00:00.000Z', '2026-05-01T01:00:00.000Z', '10:00'),
        coverage('chat-a', '2026-05-01T01:00:00.000Z', '2026-05-01T02:00:00.000Z', '10:05')
      ])
    ).toEqual([
      coverage('chat-a', '2026-05-01T00:00:00.000Z', '2026-05-01T02:00:00.000Z', '10:05')
    ]);
  });

  it('computes missing intervals from Telegram-owned coverage', () => {
    expect(
      subtractHistoryIntervals(
        [interval('2026-05-01T00:00:00.000Z', '2026-05-01T04:00:00.000Z')],
        [
          interval('2026-05-01T00:00:00.000Z', '2026-05-01T01:00:00.000Z'),
          interval('2026-05-01T03:00:00.000Z', '2026-05-01T04:00:00.000Z')
        ]
      )
    ).toEqual([interval('2026-05-01T01:00:00.000Z', '2026-05-01T03:00:00.000Z')]);
  });

  it('updates an existing coverage row when live coverage extends it', () => {
    const segment = coverage(
      'chat-a',
      '2026-05-01T00:00:00.000Z',
      '2026-05-01T02:00:00.000Z',
      '10:05'
    );

    expect(
      planHistoryCoverageMerge(
        [
          coverageRow(10, 'chat-a', '2026-05-01T00:00:00.000Z', '2026-05-01T01:00:00.000Z', '10:00')
        ],
        [segment]
      )
    ).toEqual({
      deleteIds: [],
      inserts: [],
      updates: [
        {
          id: 10,
          segment
        }
      ]
    });
  });

  it('reuses one coverage row and deletes only surplus rows when segments collapse', () => {
    const segment = coverage(
      'chat-a',
      '2026-05-01T00:00:00.000Z',
      '2026-05-01T03:00:00.000Z',
      '10:10'
    );

    expect(
      planHistoryCoverageMerge(
        [
          coverageRow(
            10,
            'chat-a',
            '2026-05-01T00:00:00.000Z',
            '2026-05-01T01:00:00.000Z',
            '10:00'
          ),
          coverageRow(11, 'chat-a', '2026-05-01T02:00:00.000Z', '2026-05-01T03:00:00.000Z', '10:05')
        ],
        [segment]
      )
    ).toEqual({
      deleteIds: [11],
      inserts: [],
      updates: [
        {
          id: 10,
          segment
        }
      ]
    });
  });

  it('does not update a coverage row that already matches the merged segment', () => {
    const segment = coverage(
      'chat-a',
      '2026-05-01T00:00:00.000Z',
      '2026-05-01T02:00:00.000Z',
      '10:05'
    );

    expect(
      planHistoryCoverageMerge(
        [
          coverageRow(10, 'chat-a', '2026-05-01T00:00:00.000Z', '2026-05-01T02:00:00.000Z', '10:05')
        ],
        [segment]
      )
    ).toEqual({
      deleteIds: [],
      inserts: [],
      updates: []
    });
  });

  it('does not refresh an existing coverage row only because proof time changed', () => {
    const segment = coverage(
      'chat-a',
      '2026-05-01T00:00:00.000Z',
      '2026-05-01T02:00:00.000Z',
      '10:30'
    );

    expect(
      planHistoryCoverageMerge(
        [
          coverageRow(10, 'chat-a', '2026-05-01T00:00:00.000Z', '2026-05-01T02:00:00.000Z', '10:05')
        ],
        [segment]
      )
    ).toEqual({
      deleteIds: [],
      inserts: [],
      updates: []
    });
  });

  it('lists only restorable stored chats', async () => {
    const captured: CapturedHistoryChatQuery = {};
    const chats = await listHistoryChats(
      historyChatsDatabase(captured, [
        historyChatRow('100', 'channel', [{ _: 'chatListMain' }]),
        historyChatRow('200', 'private', []),
        historyChatRow('300', 'group', null),
        historyChatRow('400', 'secret', { _: 'chatListMain' }),
        historyChatRow('500', 'chatTypeUnsupported', [{ _: 'chatListMain' }]),
        historyChatRow('600', 'group', [{ _: 'chatListArchive' }])
      ])
    );

    expect(chats).toEqual([
      {
        chatId: '100',
        type: 'channel'
      },
      {
        chatId: '600',
        type: 'group'
      }
    ]);

    const where = compileCapturedSql(captured.where);
    expect(where.sql).toContain('case');
    expect(where.sql).toContain('jsonb_typeof("telegram_chats"."chat_lists") = \'array\'');
    expect(where.sql).toContain('jsonb_array_length("telegram_chats"."chat_lists") > 0');
    expect(where.sql).toContain('else false');
  });
});

function interval(startAt: string, endAt: string) {
  return {
    endAt: new Date(endAt),
    startAt: new Date(startAt)
  };
}

function coverage(chatId: string, startAt: string, endAt: string, coveredAt: string) {
  return {
    ...interval(startAt, endAt),
    chatId,
    coveredAt: provedAt(coveredAt)
  };
}

function coverageRow(
  id: number,
  chatId: string,
  startAt: string,
  endAt: string,
  coveredAt: string
) {
  return {
    ...interval(startAt, endAt),
    coveredAt: provedAt(coveredAt),
    id,
    ownerKey: `chat:${chatId}`,
    ownerKind: 'chat',
    telegramChatId: chatId
  };
}

function provedAt(time: string): Date {
  return new Date(`2026-05-01T${time}:00.000Z`);
}

type CapturedHistoryChatQuery = {
  where?: SQL;
};

type HistoryChatRow = {
  chatLists: unknown;
  telegramChatId: string;
  type: string;
};

function historyChatsDatabase(
  captured: CapturedHistoryChatQuery,
  rows: HistoryChatRow[]
): Database {
  return {
    select() {
      return {
        from() {
          return {
            where(condition: SQL) {
              captured.where = condition;
              return {
                orderBy() {
                  return Promise.resolve(rows);
                }
              };
            }
          };
        }
      };
    }
  } as unknown as Database;
}

function historyChatRow(telegramChatId: string, type: string, chatLists: unknown): HistoryChatRow {
  return {
    chatLists,
    telegramChatId,
    type
  };
}

function compileCapturedSql(value: SQL | undefined) {
  if (value === undefined) {
    throw new Error('Expected captured SQL expression');
  }
  return new PgDialect().sqlToQuery(value);
}
