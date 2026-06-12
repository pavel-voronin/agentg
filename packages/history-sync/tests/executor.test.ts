import type { EventBus, EventSubscription } from '@agentg/framework';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../src/database/client.js';
import { historySyncTargets, historySyncTemplates } from '../src/database/schema.js';
import type {
  HistorySyncTarget,
  HistorySyncTemplate,
  TelegramHistoryClient
} from '../src/model/types.js';
import { absoluteBoundary, expressionBoundary, historySyncRange } from '../src/range/ranges.js';
import { runHistorySync, type SyncRunRequest } from '../src/sync/executor.js';

describe('history sync executor', () => {
  it('skips without Telegram calls when there is no local demand', async () => {
    const events = createFakeEventBus();
    const database = createFakeHistorySyncDatabase();
    const telegram = createFakeTelegramHistoryClient();

    await runHistorySync(
      database as unknown as Database,
      telegram,
      events,
      relativeTargetsRequest(),
      syncOptions()
    );

    expect(telegram.listChats).not.toHaveBeenCalled();
    expect(telegram.ensureHistoryCoverage).not.toHaveBeenCalled();
    expect(events.published()).toEqual(
      expect.arrayContaining([
        {
          data: {
            mode: 'target_relative',
            reason: 'relative-targets',
            skipReason: 'no_demand',
            targets: 0,
            templates: 0
          },
          type: 'history-sync.sync.skipped'
        }
      ])
    );
  });

  it('executes only relative targets during relative scheduler demand', async () => {
    const database = createFakeHistorySyncDatabase({
      targets: [
        {
          chatId: 'chat-relative',
          id: 'target-relative',
          range: historySyncRange(expressionBoundary('now-30d'), expressionBoundary('now'))
        },
        {
          chatId: 'chat-absolute',
          id: 'target-absolute',
          range: historySyncRange(
            absoluteBoundary('2026-01-01T00:00:00.000Z'),
            absoluteBoundary('2026-01-02T00:00:00.000Z')
          )
        }
      ]
    });
    const telegram = createFakeTelegramHistoryClient();

    await runHistorySync(
      database as unknown as Database,
      telegram,
      createFakeEventBus(),
      relativeTargetsRequest(),
      syncOptions()
    );

    expect(telegram.listChats).not.toHaveBeenCalled();
    expect(telegram.ensureHistoryCoverage).toHaveBeenCalledTimes(1);
    expect(telegram.ensureHistoryCoverage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'chat-relative',
        maxPages: 1
      })
    );
  });

  it('deletes targets for chats missing during full reconciliation', async () => {
    const events = createFakeEventBus();
    const database = createFakeHistorySyncDatabase({
      targets: [
        {
          chatId: 'chat-orphan',
          id: 'target-orphan',
          range: historySyncRange(expressionBoundary('now-30d'), expressionBoundary('now'))
        }
      ]
    });
    const telegram = createFakeTelegramHistoryClient({
      listChats: vi.fn(() => Promise.resolve([]))
    });

    await runHistorySync(
      database as unknown as Database,
      telegram,
      events,
      fullRequest('manual', false),
      syncOptions()
    );

    expect(telegram.listChats).toHaveBeenCalledWith({
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

  it('materializes a discovered chat through a narrow Telegram lookup', async () => {
    const database = createFakeHistorySyncDatabase({
      targets: [
        {
          chatId: 'chat-existing',
          id: 'target-existing',
          range: historySyncRange(expressionBoundary('now-30d'), expressionBoundary('now'))
        }
      ],
      templates: [
        {
          id: 'template-private',
          match: {
            chatType: 'private'
          },
          range: historySyncRange(expressionBoundary('now-30d'), expressionBoundary('now'))
        }
      ]
    });
    const telegram = createFakeTelegramHistoryClient({
      getChatHistoryFacts: vi.fn(() =>
        Promise.resolve({
          chat: {
            _model: 'telegram.chat' as const,
            id: 'chat-1',
            isBot: false,
            title: 'Private Chat',
            type: 'private',
            updatedAt: new Date(0).toISOString()
          },
          earliestMessageDate: null,
          messageCount: 0
        })
      )
    });

    await runHistorySync(
      database as unknown as Database,
      telegram,
      createFakeEventBus(),
      discoveredRequest('chat-1'),
      syncOptions()
    );

    expect(telegram.listChats).not.toHaveBeenCalled();
    expect(telegram.getChatHistoryFacts).toHaveBeenCalledWith({
      chatId: 'chat-1'
    });
    expect(database.targets()).toEqual([
      expect.objectContaining({
        id: 'target-existing',
        telegramChatId: 'chat-existing',
        templateId: null
      }),
      expect.objectContaining({
        id: 'template-private:chat-1',
        telegramChatId: 'chat-1',
        templateId: 'template-private'
      })
    ]);
    expect(database.upsertedTargetIds()).toEqual(['template-private:chat-1']);
    expect(telegram.ensureHistoryCoverage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'chat-1'
      })
    );
  });

  it('deletes covered absolute one-shot targets', async () => {
    const database = createFakeHistorySyncDatabase({
      targets: [
        {
          chatId: 'chat-1',
          id: 'target-absolute',
          range: historySyncRange(
            absoluteBoundary('2026-01-01T00:00:00.000Z'),
            absoluteBoundary('2026-01-02T00:00:00.000Z')
          )
        }
      ]
    });
    const telegram = createFakeTelegramHistoryClient({
      getHistoryCoverage: vi.fn(() =>
        Promise.resolve({
          coverage: [
            {
              coveredAt: new Date(0).toISOString(),
              endAt: '2026-01-02T00:00:00.000Z',
              startAt: '2026-01-01T00:00:00.000Z'
            }
          ]
        })
      )
    });

    await runHistorySync(
      database as unknown as Database,
      telegram,
      createFakeEventBus(),
      targetSelectedRequest('target-upserted', 'chat-1'),
      syncOptions()
    );

    expect(database.deletedTargetIds()).toEqual(['target-absolute']);
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

type HistorySyncTemplateRow = {
  id: string;
  match: HistorySyncTemplate['match'];
  range: HistorySyncTemplate['range'];
};

function syncOptions() {
  return {
    chatLoadBatchSize: 100,
    messageLimit: 100,
    requestDelayMs: 0,
    windowDays: 30
  };
}

function fullRequest(reason: string, discoverChats: boolean): SyncRunRequest {
  return {
    discoveredChatIds: new Set(),
    discoverChats,
    fullReconcile: true,
    reason,
    targetScope: 'all'
  };
}

function relativeTargetsRequest(): SyncRunRequest {
  return {
    discoveredChatIds: new Set(),
    discoverChats: false,
    fullReconcile: false,
    reason: 'relative-targets',
    targetScope: 'relative'
  };
}

function targetSelectedRequest(reason: string, chatId: string): SyncRunRequest {
  return {
    discoveredChatIds: new Set(),
    discoverChats: false,
    fullReconcile: false,
    reason,
    targetScope: 'selected',
    targetChatIds: new Set([chatId])
  };
}

function discoveredRequest(chatId: string): SyncRunRequest {
  return {
    discoveredChatIds: new Set([chatId]),
    discoverChats: false,
    fullReconcile: false,
    reason: 'chat-discovered',
    targetScope: 'selected',
    targetChatIds: new Set([chatId])
  };
}

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
  overrides: Partial<TelegramHistoryClient> = {}
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

function createFakeHistorySyncDatabase(
  options: {
    targets?: HistorySyncTarget[];
    templates?: HistorySyncTemplate[];
  } = {}
) {
  let currentTargets = (options.targets ?? []).map(toHistorySyncTargetRow);
  const templates = (options.templates ?? []).map(toHistorySyncTemplateRow);
  const deletedTargetIds: string[] = [];
  const upsertedTargetIds: string[] = [];

  return {
    deletedTargetIds(): string[] {
      return deletedTargetIds;
    },
    targets(): HistorySyncTargetRow[] {
      return currentTargets;
    },
    upsertedTargetIds(): string[] {
      return upsertedTargetIds;
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
    insert(table: unknown) {
      let insertedRows: HistorySyncTargetRow[] = [];
      const query = {
        onConflictDoUpdate() {
          if (table === historySyncTargets) {
            for (const row of insertedRows) {
              const existingIndex = currentTargets.findIndex((target) => target.id === row.id);
              if (existingIndex >= 0) {
                currentTargets[existingIndex] = row;
              } else {
                currentTargets.push(row);
              }
              upsertedTargetIds.push(row.id);
            }
          }
          return Promise.resolve();
        },
        values(value: HistorySyncTargetRow | HistorySyncTargetRow[]) {
          insertedRows = Array.isArray(value) ? value : [value];
          return query;
        }
      };
      return query;
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
      return templates;
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

function toHistorySyncTemplateRow(template: HistorySyncTemplate): HistorySyncTemplateRow {
  return {
    id: template.id,
    match: template.match,
    range: template.range
  };
}
