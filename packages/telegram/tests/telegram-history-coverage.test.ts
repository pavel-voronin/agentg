import { describe, expect, it } from 'vitest';

import {
  normalizeCoverageSegments,
  subtractTelegramHistoryIntervals
} from '../src/telegram-history-coverage.js';

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
      subtractTelegramHistoryIntervals(
        [interval('2026-05-01T00:00:00.000Z', '2026-05-01T04:00:00.000Z')],
        [
          interval('2026-05-01T00:00:00.000Z', '2026-05-01T01:00:00.000Z'),
          interval('2026-05-01T03:00:00.000Z', '2026-05-01T04:00:00.000Z')
        ]
      )
    ).toEqual([interval('2026-05-01T01:00:00.000Z', '2026-05-01T03:00:00.000Z')]);
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

function provedAt(time: string): Date {
  return new Date(`2026-05-01T${time}:00.000Z`);
}
