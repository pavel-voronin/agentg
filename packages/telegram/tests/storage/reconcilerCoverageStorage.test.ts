import { describe, expect, it } from 'vitest';

import {
  normalizeOwnerCoverageSegments,
  type OwnerCoverageSegment
} from '../../src/storage/reconcilerCoverageStorage.js';

describe('Telegram owner coverage', () => {
  it('does not merge owner intervals across a time gap', () => {
    expect(
      normalizeOwnerCoverageSegments([
        segment('2026-06-12T00:00:00.000Z', '2026-06-12T00:00:01.000Z'),
        segment('2026-06-12T00:00:02.000Z', '2026-06-12T00:00:03.000Z')
      ])
    ).toEqual([
      segment('2026-06-12T00:00:00.000Z', '2026-06-12T00:00:01.000Z'),
      segment('2026-06-12T00:00:02.000Z', '2026-06-12T00:00:03.000Z')
    ]);
  });

  it('still merges touching owner intervals', () => {
    expect(
      normalizeOwnerCoverageSegments([
        segment('2026-06-12T00:00:00.000Z', '2026-06-12T00:00:01.000Z'),
        segment('2026-06-12T00:00:01.000Z', '2026-06-12T00:00:02.000Z')
      ])
    ).toEqual([segment('2026-06-12T00:00:00.000Z', '2026-06-12T00:00:02.000Z')]);
  });
});

function segment(startAt: string, endAt: string): OwnerCoverageSegment {
  return {
    coveredAt: new Date('2026-06-12T00:10:00.000Z'),
    endAt: new Date(endAt),
    ownerKey: 'chat:123',
    ownerKind: 'chat',
    startAt: new Date(startAt)
  };
}
