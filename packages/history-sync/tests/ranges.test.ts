import { describe, expect, it } from 'vitest';

import { mergeIntervals, projectHistorySyncRange, splitIntervals } from '../src/range/ranges.js';

describe('history ranges', () => {
  it('projects relative history boundaries from the provided clock', () => {
    const interval = projectHistorySyncRange(
      {
        end: {
          expression: 'now',
          kind: 'expression'
        },
        start: {
          expression: 'now-2d',
          kind: 'expression'
        }
      },
      {
        now: new Date('2026-06-02T12:00:00.000Z')
      }
    );

    expect(interval).toEqual({
      endAt: new Date('2026-06-02T12:00:00.000Z'),
      startAt: new Date('2026-05-31T12:00:00.000Z')
    });
  });

  it('merges overlapping intervals and keeps disjoint coverage separate', () => {
    expect(
      mergeIntervals([
        {
          endAt: new Date('2026-06-02T12:00:00.000Z'),
          startAt: new Date('2026-06-02T10:00:00.000Z')
        },
        {
          endAt: new Date('2026-06-02T11:00:00.000Z'),
          startAt: new Date('2026-06-02T09:00:00.000Z')
        },
        {
          endAt: new Date('2026-06-01T12:00:00.000Z'),
          startAt: new Date('2026-06-01T11:00:00.000Z')
        }
      ])
    ).toEqual([
      {
        endAt: new Date('2026-06-01T12:00:00.000Z'),
        startAt: new Date('2026-06-01T11:00:00.000Z')
      },
      {
        endAt: new Date('2026-06-02T12:00:00.000Z'),
        startAt: new Date('2026-06-02T09:00:00.000Z')
      }
    ]);
  });

  it('splits intervals from the newest edge first', () => {
    expect(
      splitIntervals(
        [
          {
            endAt: new Date('2026-06-02T12:00:00.000Z'),
            startAt: new Date('2026-06-02T09:00:00.000Z')
          }
        ],
        60 * 60 * 1000
      )
    ).toEqual([
      {
        endAt: new Date('2026-06-02T12:00:00.000Z'),
        startAt: new Date('2026-06-02T11:00:00.000Z')
      },
      {
        endAt: new Date('2026-06-02T11:00:00.000Z'),
        startAt: new Date('2026-06-02T10:00:00.000Z')
      },
      {
        endAt: new Date('2026-06-02T10:00:00.000Z'),
        startAt: new Date('2026-06-02T09:00:00.000Z')
      }
    ]);
  });
});
