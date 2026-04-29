import { describe, expect, it } from 'vitest';

import {
  absoluteBoundary,
  expressionBoundary,
  historyRange,
  projectHistoryRange
} from '../../src/history-sync/ranges.js';

describe('history range projection', () => {
  const now = new Date('2026-04-28T00:00:00.000Z');

  it('projects an absolute start and absolute end', () => {
    expect(
      projectHistoryRange(
        historyRange(absoluteBoundary('2026-01-01T00:00:00.000Z'), absoluteBoundary(now)),
        { now }
      )
    ).toEqual({
      endAt: now,
      startAt: new Date('2026-01-01T00:00:00.000Z')
    });
  });

  it('projects expression boundaries using the provided current time', () => {
    expect(
      projectHistoryRange(historyRange(expressionBoundary('now-30d'), expressionBoundary('now')), {
        now
      })
    ).toEqual({
      endAt: now,
      startAt: new Date('2026-03-29T00:00:00.000Z')
    });
  });

  it('normalizes projected ranges to Telegram-second boundaries', () => {
    expect(
      projectHistoryRange(
        historyRange(
          absoluteBoundary('2026-01-01T00:00:00.250Z'),
          absoluteBoundary('2026-01-01T00:00:01.250Z')
        ),
        { now }
      )
    ).toEqual({
      endAt: new Date('2026-01-01T00:00:02.000Z'),
      startAt: new Date('2026-01-01T00:00:00.000Z')
    });
  });

  it('projects an absolute start and expression end such as 2026-01-01 to now', () => {
    expect(
      projectHistoryRange(
        historyRange(absoluteBoundary('2026-01-01T00:00:00.000Z'), expressionBoundary('now')),
        { now }
      )
    ).toEqual({
      endAt: now,
      startAt: new Date('2026-01-01T00:00:00.000Z')
    });
  });

  it('projects a literal expression such as past', () => {
    const past = new Date('2013-08-14T00:00:00.000Z');

    expect(
      projectHistoryRange(historyRange(expressionBoundary('past'), expressionBoundary('now')), {
        literals: { past },
        now
      })
    ).toEqual({
      endAt: now,
      startAt: past
    });
  });

  it('stores boundary literals as literals instead of nulls', () => {
    expect(expressionBoundary('past')).toEqual({
      expression: 'past',
      kind: 'expression'
    });
  });
});
