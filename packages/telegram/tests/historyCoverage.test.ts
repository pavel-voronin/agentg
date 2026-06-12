import { describe, expect, it } from 'vitest';

import {
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
