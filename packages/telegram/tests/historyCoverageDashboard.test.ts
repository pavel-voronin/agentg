import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  countMessageRowsByRanges: vi.fn(),
  listHistoryCoverage: vi.fn()
}));

vi.mock('../src/storage/historyCoverageStorage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/storage/historyCoverageStorage.js')>();
  return {
    ...actual,
    listHistoryCoverage: storage.listHistoryCoverage
  };
});

vi.mock('../src/storage/messageReadStorage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/storage/messageReadStorage.js')>();
  return {
    ...actual,
    countMessageRowsByRanges: storage.countMessageRowsByRanges
  };
});

import type { Database } from '../src/database/client.js';
import { createProcedures } from '../dashboard/backend/procedures.js';

describe('Telegram Dashboard history coverage', () => {
  beforeEach(() => {
    storage.countMessageRowsByRanges.mockReset();
    storage.listHistoryCoverage.mockReset();
  });

  it('returns direct chat coverage intervals for the selected chat', async () => {
    const database = {} as Database;
    storage.listHistoryCoverage.mockResolvedValue([
      {
        chatId: '123',
        coveredAt: new Date('2026-05-01T02:00:00.000Z'),
        endAt: new Date('2026-05-01T02:00:00.000Z'),
        startAt: new Date('2026-05-01T01:00:00.000Z')
      }
    ]);
    storage.countMessageRowsByRanges.mockResolvedValue([17]);

    const result = await procedures(database)['telegram.dashboard.historyCoverage']({
      chatId: '123'
    });

    expect(storage.listHistoryCoverage).toHaveBeenCalledWith(database, '123');
    expect(storage.countMessageRowsByRanges).toHaveBeenCalledWith(database, {
      chatId: '123',
      ranges: [
        {
          chatId: '123',
          coveredAt: new Date('2026-05-01T02:00:00.000Z'),
          endAt: new Date('2026-05-01T02:00:00.000Z'),
          startAt: new Date('2026-05-01T01:00:00.000Z')
        }
      ]
    });
    expect(result).toEqual({
      chatId: '123',
      coverage: [
        {
          coveredAt: '2026-05-01T02:00:00.000Z',
          endAt: '2026-05-01T02:00:00.000Z',
          messageCount: 17,
          startAt: '2026-05-01T01:00:00.000Z'
        }
      ]
    });
  });
});

function procedures(database: Database): ReturnType<typeof createProcedures> {
  return createProcedures({
    database,
    events: {},
    telegram: {
      getMessages() {
        return Promise.reject(new Error('getMessages is not used by this test'));
      },
      requestFile() {
        return Promise.reject(new Error('requestFile is not used by this test'));
      }
    }
  } as unknown as Parameters<typeof createProcedures>[0]);
}
