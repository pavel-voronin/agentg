import type { IntegrationEvent } from '@agentg/events/envelope';
import { describe, expect, it, vi } from 'vitest';

import type { HistorySyncDatabase as AppDatabase } from '../../src/database.js';
import { runHistorySync } from '../../src/executor.js';
import { expressionBoundary, historySyncRange } from '../../src/ranges.js';
import { historySyncTargets, historySyncTemplates } from '../../src/schema.js';
import type { TelegramHistoryClient } from '../../src/telegram-client.js';
import type { HistorySyncTarget } from '../../src/types.js';

describe('history sync executor', () => {
  it('deletes targets for chats that are no longer listed by Telegram', async () => {
    const publishedEvents: IntegrationEvent[] = [];
    const database = createFakeHistorySyncDatabase([
      {
        chatId: 'chat-orphan',
        id: 'target-orphan',
        range: historySyncRange(expressionBoundary('now-30d'), expressionBoundary('now'))
      }
    ]);
    const listChats = vi.fn(() => Promise.resolve([]));
    const client = {
      ensureHistoryCoverage: vi.fn(),
      getHistoryCoverage: vi.fn(),
      listChats
    } as unknown as TelegramHistoryClient;
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      await runHistorySync(database as unknown as AppDatabase, client, {
        chatLoadBatchSize: 100,
        discoverChats: false,
        messageLimit: 100,
        publishEvent: (event) => {
          publishedEvents.push(event);
        },
        requestDelayMs: 0,
        syncWindowDays: 30
      });
    } finally {
      consoleLog.mockRestore();
    }

    expect(listChats).toHaveBeenCalledWith({
      discover: false,
      loadBatchSize: 100
    });
    expect(database.deletedTargetIds()).toEqual(['target-orphan']);
    expect(publishedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: {
            chatId: 'chat-orphan',
            targetId: 'target-orphan'
          },
          type: 'history-sync.target.auto_deleted'
        })
      ])
    );
  });
});

type HistorySyncTargetRow = {
  id: string;
  range: HistorySyncTarget['range'];
  telegramChatId: string;
  templateId: string | null;
};

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
        limit() {
          return query;
        },
        orderBy() {
          return query;
        },
        then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(selectRows(selectedTable)).then(resolve, reject);
        },
        where() {
          return query;
        }
      };
      return query;
    },
    update() {
      return {
        set() {
          return {
            where(): Promise<void> {
              return Promise.resolve();
            }
          };
        }
      };
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
