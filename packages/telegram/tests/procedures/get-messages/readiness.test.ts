import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../../../src/database/client.js';
import { HISTORY_PAST_BOUNDARY } from '../../../src/history/time.js';
import type { GetMessagesInput } from '../../../src/procedures/get-messages/contract.js';

const coverage = vi.hoisted(() => ({
  isOwnerCovered: vi.fn(),
  missingOwnerCoverageIntervals: vi.fn()
}));

const read = vi.hoisted(() => ({
  readPageEndAt: vi.fn(),
  readPageRows: vi.fn(),
  readRangeRows: vi.fn()
}));

vi.mock('../../../src/reconciler/coverage.js', () => ({
  isOwnerCovered: coverage.isOwnerCovered,
  missingOwnerCoverageIntervals: coverage.missingOwnerCoverageIntervals
}));

vi.mock('../../../src/procedures/get-messages/read.js', () => read);

import { checkMessagesReadiness } from '../../../src/procedures/get-messages/readiness.js';

describe('Telegram getMessages readiness', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns an empty latest page only when current owner coverage proves it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T12:00:00.500Z'));
    read.readPageRows.mockResolvedValue([]);
    read.readPageEndAt.mockResolvedValue(undefined);
    coverage.isOwnerCovered.mockResolvedValue(true);

    const result = await checkMessagesReadiness({} as Database, latestPageInput());

    expect(result).toEqual({
      ready: true,
      rows: {
        messages: [],
        reachedStart: true,
        selectorKind: 'page'
      }
    });
    expect(coverage.isOwnerCovered).toHaveBeenCalledWith({}, latestPageInput().owner, {
      endAt: new Date('2026-06-12T12:00:00.000Z'),
      startAt: HISTORY_PAST_BOUNDARY
    });
  });

  it('does not treat stale past coverage as an empty latest page proof', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T12:00:00.500Z'));
    read.readPageRows.mockResolvedValue([]);
    read.readPageEndAt.mockResolvedValue(undefined);
    coverage.isOwnerCovered.mockResolvedValue(false);

    const result = await checkMessagesReadiness({} as Database, latestPageInput());

    expect(result).toEqual({
      missing: [
        {
          endAt: new Date('2026-06-12T12:00:01.000Z'),
          startAt: HISTORY_PAST_BOUNDARY
        }
      ],
      ready: false
    });
  });
});

function latestPageInput(): GetMessagesInput {
  return {
    owner: {
      chatId: '123',
      kind: 'chat'
    },
    selector: {
      count: 100,
      kind: 'page'
    }
  };
}
