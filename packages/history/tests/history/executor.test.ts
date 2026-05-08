import type { IntegrationEvent } from '@agentg/events/envelope';
import { describe, expect, it, vi } from 'vitest';

import type { HistoryDatabase as AppDatabase } from '../../src/database.js';
import { runHistorySync } from '../../src/executor.js';
import { expressionBoundary, historyRange } from '../../src/ranges.js';
import { historyBackfillJobs, historyTargets, historyTemplates } from '../../src/schema.js';
import type { TelegramHistoryClient } from '../../src/telegram-client.js';
import type { HistoryTarget } from '../../src/types.js';

describe('history sync executor', () => {
  it('deletes targets for chats that are no longer listed by Telegram', async () => {
    const publishedEvents: IntegrationEvent[] = [];
    const database = createFakeHistoryDatabase([
      {
        chatId: 'chat-orphan',
        id: 'target-orphan',
        range: historyRange(expressionBoundary('now-30d'), expressionBoundary('now'))
      }
    ]);
    const listChats = vi.fn(() => Promise.resolve([]));
    const client = {
      fetchPage: vi.fn(),
      listChats
    } as unknown as TelegramHistoryClient;
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      await runHistorySync(database as unknown as AppDatabase, client, {
        chatLoadBatchSize: 100,
        discoverChats: false,
        jobWindowDays: 30,
        messageLimit: 100,
        publishEvent: (event) => {
          publishedEvents.push(event);
        },
        requestDelayMs: 0
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
          type: 'history.target.auto_deleted'
        })
      ])
    );
  });
});

type HistoryTargetRow = {
  id: string;
  range: HistoryTarget['range'];
  telegramChatId: string;
  templateId: string | null;
};

function createFakeHistoryDatabase(targets: HistoryTarget[]) {
  let currentTargets = targets.map(toHistoryTargetRow);
  const deletedTargetIds: string[] = [];

  return {
    deletedTargetIds(): string[] {
      return deletedTargetIds;
    },
    delete(table: unknown) {
      return {
        where() {
          return {
            returning(): Promise<HistoryTargetRow[]> {
              if (table !== historyTargets) {
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
    if (table === historyTemplates) {
      return [];
    }
    if (table === historyTargets) {
      return currentTargets;
    }
    if (table === historyBackfillJobs) {
      return [];
    }
    throw new Error('Unexpected history test table selection');
  }
}

function toHistoryTargetRow(target: HistoryTarget): HistoryTargetRow {
  return {
    id: target.id,
    range: target.range,
    telegramChatId: target.chatId,
    templateId: target.templateId ?? null
  };
}
