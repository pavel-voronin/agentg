import type { EventBus } from '@agentg/framework';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../src/database/client.js';
import { historySyncTargets } from '../src/database/schema.js';
import type { TelegramHistoryClient } from '../src/model/types.js';
import { createProcedures } from '../src/procedures/index.js';
import type { Controller } from '../src/sync/controller.js';
import { createTargetState } from '../src/target/targetState.js';

describe('history sync procedures', () => {
  it('updates runtime target state in the same path as database target mutations', async () => {
    const database = createFakeHistorySyncDatabase();
    const targets = createTargetState();
    const procedures = createProcedures({
      controller: createFakeController(),
      database: database as unknown as Database,
      events: createFakeEventBus(),
      targets,
      telegram: createFakeTelegramHistoryClient()
    });

    const upserted = await procedures.upsertTarget({
      chatId: 'chat-1',
      range: {
        end: {
          expression: 'now',
          kind: 'expression'
        },
        start: {
          expression: 'now-15m',
          kind: 'expression'
        }
      }
    });

    expect(targets.hasRelativeTargets()).toBe(true);
    expect(targets.targets().map((target) => target.id)).toEqual([upserted.target?.id]);

    await procedures.deleteTarget({
      targetId: upserted.target?.id
    });

    expect(targets.hasRelativeTargets()).toBe(false);
    expect(targets.targets()).toEqual([]);
  });
});

type TargetRow = {
  id: string;
  range: unknown;
  telegramChatId: string;
  templateId: string | null;
};

function createFakeHistorySyncDatabase() {
  let targetRows: TargetRow[] = [];

  return {
    delete(table: unknown) {
      const query = {
        returning() {
          if (table !== historySyncTargets) {
            throw new Error('Unexpected delete table');
          }
          const deleted = targetRows[0];
          targetRows = targetRows.slice(1);
          return Promise.resolve(deleted === undefined ? [] : [deleted]);
        },
        where() {
          return query;
        }
      };
      return query;
    },
    insert(table: unknown) {
      let insertedRow: TargetRow | undefined;
      const query = {
        onConflictDoUpdate() {
          if (table !== historySyncTargets || insertedRow === undefined) {
            throw new Error('Unexpected target upsert');
          }
          const row = insertedRow;
          targetRows = [...targetRows.filter((candidate) => candidate.id !== row.id), row];
          return Promise.resolve();
        },
        values(value: TargetRow) {
          insertedRow = value;
          return query;
        }
      };
      return query;
    }
  };
}

function createFakeController(): Controller {
  return {
    request: vi.fn(),
    stop: vi.fn(),
    wait: vi.fn(() => Promise.resolve())
  };
}

function createFakeEventBus(): EventBus {
  return {
    publish: vi.fn(),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    subscribe: vi.fn(() => ({
      unsubscribe: vi.fn()
    }))
  };
}

function createFakeTelegramHistoryClient(): TelegramHistoryClient {
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
    listChats: vi.fn(() => Promise.resolve([]))
  };
}
