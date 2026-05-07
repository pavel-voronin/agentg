import { describe, expect, it } from 'vitest';

import {
  absoluteBoundary,
  canonicalizeHistoryRange,
  expressionBoundary,
  historyRange,
  projectHistoryRange
} from '../../src/ranges.js';

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

  it('projects minute expression boundaries using the provided current time', () => {
    expect(
      projectHistoryRange(historyRange(expressionBoundary('now-1m'), expressionBoundary('now')), {
        now
      })
    ).toEqual({
      endAt: now,
      startAt: new Date('2026-04-27T23:59:00.000Z')
    });
  });

  it('projects compound expression boundaries from larger to smaller units', () => {
    expect(
      projectHistoryRange(
        historyRange(expressionBoundary('now-1y2mo3w4d5h6m7s'), expressionBoundary('now')),
        { now }
      )
    ).toEqual({
      endAt: now,
      startAt: new Date('2025-02-02T18:53:53.000Z')
    });
  });

  it('projects signed arithmetic expression boundaries', () => {
    expect(
      projectHistoryRange(
        historyRange(expressionBoundary('now-1y+2mo-3d+4h'), expressionBoundary('now')),
        { now }
      )
    ).toEqual({
      endAt: now,
      startAt: new Date('2025-06-25T04:00:00.000Z')
    });
  });

  it('projects arithmetic from literal expression boundaries', () => {
    const past = new Date('2013-08-14T00:00:00.000Z');

    expect(
      projectHistoryRange(
        historyRange(expressionBoundary('past+1y'), expressionBoundary('past+1y1s')),
        { literals: { past }, now }
      )
    ).toEqual({
      endAt: new Date('2014-08-14T00:00:01.000Z'),
      startAt: new Date('2014-08-14T00:00:00.000Z')
    });
  });

  it('rejects compound expression boundaries with units out of order', () => {
    expect(() =>
      projectHistoryRange(historyRange(expressionBoundary('now-1m1h'), expressionBoundary('now')), {
        now
      })
    ).toThrow('Unknown history boundary expression: now-1m1h');
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

  it('canonicalizes absolute target boundaries to Telegram-second boundaries', () => {
    expect(
      canonicalizeHistoryRange(
        historyRange(
          absoluteBoundary('2026-01-01T00:00:00.250Z'),
          absoluteBoundary('2026-01-01T00:00:01.250Z')
        )
      )
    ).toEqual(
      historyRange(
        absoluteBoundary('2026-01-01T00:00:00.000Z'),
        absoluteBoundary('2026-01-01T00:00:02.000Z')
      )
    );
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
