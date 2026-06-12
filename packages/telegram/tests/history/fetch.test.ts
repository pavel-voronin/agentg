import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { message as Message } from 'tdlib-types';

import { writeHistoryCoverageInTransaction } from '../../src/history/coverage.js';
import { fetchHistoryPage, type HistoryResources } from '../../src/history/fetch.js';
import { messagesNeedingFileRecording } from '../../src/history/fileRecording.js';
import { countMessagesInIntervals } from '../../src/history/messageCounts.js';
import { storeMessage } from '../../src/store/message.js';

vi.mock('../../src/store/message.js', () => ({
  storeMessage: vi.fn(() => Promise.resolve(true))
}));

vi.mock('../../src/history/fileRecording.js', () => ({
  messagesNeedingFileRecording: vi.fn(() => Promise.resolve([]))
}));

vi.mock('../../src/history/messageCounts.js', () => ({
  countMessagesInIntervals: vi.fn(() => Promise.resolve([2]))
}));

vi.mock('../../src/history/coverage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/history/coverage.js')>();
  return {
    ...actual,
    withHistoryCoverageLocks: vi.fn(async (_chatIds: string[], operation: () => Promise<unknown>) =>
      operation()
    ),
    writeHistoryCoverageInTransaction: vi.fn(() => Promise.resolve(undefined))
  };
});

describe('Telegram history fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storeMessage).mockResolvedValue(true);
    vi.mocked(messagesNeedingFileRecording).mockResolvedValue([]);
    vi.mocked(countMessagesInIntervals).mockResolvedValue([2]);
    vi.mocked(writeHistoryCoverageInTransaction).mockResolvedValue(undefined);
  });

  it('records coverage through the requested end when the anchor proves the top gap', async () => {
    const newest = message(102, '2026-05-01T13:50:00.000Z');
    const oldest = message(101, '2026-05-01T13:00:00.000Z');
    const resources = historyResources({
      getChatHistory: vi.fn(() =>
        Promise.resolve({
          _: 'messages' as const,
          messages: [newest, oldest],
          total_count: 2
        })
      ),
      getChatMessageByDate: vi.fn(() => Promise.resolve(newest))
    });

    const result = await fetchHistoryPage(
      {
        chatId: '123',
        endAt: '2026-05-01T14:00:00.000Z',
        limit: 2,
        startAt: '2013-08-14T00:00:00.000Z'
      },
      resources
    );

    expect(result).toMatchObject({
      coveredInterval: {
        endAt: '2026-05-01T14:00:00.000Z',
        startAt: '2026-05-01T13:00:01.000Z'
      },
      kind: 'page'
    });
    expect(writeHistoryCoverageInTransaction).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({
        chatId: '123',
        endAt: new Date('2026-05-01T14:00:00.000Z'),
        startAt: new Date('2026-05-01T13:00:01.000Z')
      })
    ]);
  });
});

function historyResources(input: {
  getChatHistory: HistoryResources['tdlib']['getChatHistory'];
  getChatMessageByDate: HistoryResources['tdlib']['getChatMessageByDate'];
}): HistoryResources {
  return {
    database: {
      transaction(operation: (transaction: unknown) => Promise<unknown>) {
        return operation({});
      }
    } as HistoryResources['database'],
    events: {
      publish: vi.fn()
    } as unknown as HistoryResources['events'],
    files: {} as HistoryResources['files'],
    tdlib: {
      getChatHistory: input.getChatHistory,
      getChatMessageByDate: input.getChatMessageByDate
    } as HistoryResources['tdlib']
  };
}

function message(id: number, date: string): Message {
  return {
    _: 'message',
    chat_id: 123,
    content: {
      _: 'messageText',
      text: {
        _: 'formattedText',
        entities: [],
        text: `message-${String(id)}`
      }
    },
    date: Math.floor(new Date(date).getTime() / 1000),
    id
  } as unknown as Message;
}
