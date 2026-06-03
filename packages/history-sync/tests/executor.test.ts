import type { EventBus, EventSubscription } from '@agentg/framework';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../src/database/client.js';
import { historySyncTargets, historySyncTemplates } from '../src/database/schema.js';
import type { HistorySyncTarget, TelegramHistoryClient } from '../src/model/types.js';
import { expressionBoundary, historySyncRange } from '../src/range/ranges.js';
import { runHistorySync } from '../src/sync/executor.js';

describe('history sync executor', () => {
  it('deletes targets for chats that are no longer listed by Telegram', async () => {
    const events = createFakeEventBus();
    const database = createFakeHistorySyncDatabase([
      {
        chatId: 'chat-orphan',
        id: 'target-orphan',
        range: historySyncRange(expressionBoundary('now-30d'), expressionBoundary('now'))
      }
    ]);
    const listChats = vi.fn(() => Promise.resolve([]));
    const telegram = createFakeTelegramHistoryClient({
      listChats
    });

    await runHistorySync(database as unknown as Database, telegram, events, {
      chatLoadBatchSize: 100,
      discoverChats: false,
      messageLimit: 100,
      requestDelayMs: 0,
      windowDays: 30
    });

    expect(listChats).toHaveBeenCalledWith({
      discover: false,
      loadBatchSize: 100
    });
    expect(database.deletedTargetIds()).toEqual(['target-orphan']);
    expect(events.published()).toEqual(
      expect.arrayContaining([
        {
          data: {
            chatId: 'chat-orphan',
            targetId: 'target-orphan'
          },
          type: 'history-sync.target.auto_deleted'
        }
      ])
    );
  });
});

type PublishedEvent = {
  data?: unknown;
  type: string;
};

type HistorySyncTargetRow = {
  id: string;
  range: HistorySyncTarget['range'];
  telegramChatId: string;
  templateId: string | null;
};

function createFakeEventBus(): EventBus & {
  published(): PublishedEvent[];
} {
  const publishedEvents: PublishedEvent[] = [];
  return {
    publish(type: string, data?: unknown) {
      publishedEvents.push({ data, type });
    },
    published() {
      return publishedEvents;
    },
    start() {
      return Promise.resolve();
    },
    stop() {
      return Promise.resolve();
    },
    subscribe() {
      return {
        unsubscribe: () => undefined
      } satisfies EventSubscription;
    }
  };
}

function createFakeTelegramHistoryClient(
  overrides: Partial<TelegramHistoryClient>
): TelegramHistoryClient {
  return {
    countMessagesInIntervals: vi.fn(() => Promise.resolve({ counts: [] })),
    ensureHistoryCoverage: vi.fn(() =>
      Promise.resolve({
        alreadyCovered: false,
        coveredIntervals: [],
        fetchedMessages: 0,
        pages: 0,
        reachedBeginning: false,
        remainingIntervals: [],
        storedMessages: 0
      })
    ),
    getChatHistoryFacts: vi.fn(() =>
      Promise.resolve({
        chat: null,
        earliestMessageDate: null,
        messageCount: 0
      })
    ),
    getHistoryCoverage: vi.fn(() => Promise.resolve({ coverage: [] })),
    listChats: vi.fn(() => Promise.resolve([])),
    ...overrides
  };
}

function createFakeHistorySyncDatabase(targets: HistorySyncTarget[]) {
  let currentTargets = targets.map(toHistorySyncTargetRow);
  const deletedTargetIds: string[] = [];

  return {
    deletedTargetIds(): string[] {
      return deletedTargetIds;
    },
    delete(table: unknown) {
      return {
        where() {
          return {
            returning(): Promise<HistorySyncTargetRow[]> {
              if (table !== historySyncTargets) {
                return Promise.resolve([]);
              }

              const deleted = currentTargets[0];
              if (deleted === undefined) {
                return Promise.resolve([]);
              }

              currentTargets = currentTargets.slice(1);
              deletedTargetIds.push(deleted.id);
              return Promise.resolve([deleted]);
            }
          };
        }
      };
    },
    select() {
      let selectedTable: unknown;
      const query = {
        from(table: unknown) {
          selectedTable = table;
          return query;
        },
        orderBy() {
          return query;
        },
        then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(selectRows(selectedTable)).then(resolve, reject);
        }
      };
      return query;
    }
  };

  function selectRows(table: unknown): unknown[] {
    if (table === historySyncTemplates) {
      return [];
    }
    if (table === historySyncTargets) {
      return currentTargets;
    }
    throw new Error('Unexpected history test table selection');
  }
}

function toHistorySyncTargetRow(target: HistorySyncTarget): HistorySyncTargetRow {
  return {
    id: target.id,
    range: target.range,
    telegramChatId: target.chatId,
    templateId: target.templateId ?? null
  };
}
