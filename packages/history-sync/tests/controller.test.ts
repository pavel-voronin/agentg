import type { EventBus, EventSubscription } from '@agentg/framework';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../src/database/client.js';
import { historySyncTargets, historySyncTemplates } from '../src/database/schema.js';
import type { HistorySyncTarget, TelegramHistoryClient } from '../src/model/types.js';
import { createController } from '../src/sync/controller.js';

describe('history sync controller', () => {
  it('merges queued relative and selected requests without widening to all targets', async () => {
    const firstCoverageStarted = deferred<undefined>();
    const releaseFirstCoverage = deferred<undefined>();
    let blockedFirstCoverage = false;
    const ensureHistoryCoverage = vi.fn(async (input: unknown) => {
      const chatId = coverageChatId(input);
      if (chatId === 'chat-block' && !blockedFirstCoverage) {
        blockedFirstCoverage = true;
        firstCoverageStarted.resolve(undefined);
        await releaseFirstCoverage.promise;
      }
      return {
        alreadyCovered: false,
        coveredIntervals: [],
        fetchedMessages: 0,
        pages: 0,
        reachedBeginning: false,
        remainingIntervals: [],
        storedMessages: 0
      };
    });
    const events = createFakeEventBus();
    const snapshots: string[][] = [];
    const controller = createController(
      createFakeHistorySyncDatabase([
        {
          chatId: 'chat-block',
          id: 'target-block',
          range: absoluteRange()
        },
        {
          chatId: 'chat-relative',
          id: 'target-relative',
          range: relativeRange()
        },
        {
          chatId: 'chat-selected',
          id: 'target-selected',
          range: absoluteRange()
        },
        {
          chatId: 'chat-unselected',
          id: 'target-unselected',
          range: absoluteRange()
        }
      ]) as unknown as Database,
      createFakeTelegramHistoryClient({
        ensureHistoryCoverage
      }),
      events,
      syncOptions(),
      {
        targetsChanged(targets) {
          snapshots.push(targets.map((target) => target.id).sort());
        }
      }
    );

    controller.request('manual:chat-block');
    await firstCoverageStarted.promise;
    controller.request('relative-targets');
    controller.request('target-upserted:chat-selected');
    releaseFirstCoverage.resolve(undefined);
    await controller.wait();

    expect(ensureHistoryCoverage.mock.calls.map(([request]) => coverageChatId(request))).toEqual([
      'chat-block',
      'chat-relative',
      'chat-selected'
    ]);
    expect(acceptedModes(events.published())).toEqual(['target_selected', 'target_mixed']);
    expect(snapshots.at(-1)).toEqual([
      'target-block',
      'target-relative',
      'target-selected',
      'target-unselected'
    ]);
  });
});

type PublishedEvent = {
  data?: unknown;
  type: string;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
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

function createFakeHistorySyncDatabase(targets: HistorySyncTarget[]) {
  const targetRows = targets.map((target) => ({
    id: target.id,
    range: target.range,
    telegramChatId: target.chatId,
    templateId: target.templateId ?? null
  }));

  return {
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
          return Promise.resolve(selectRows(selectedTable, targetRows)).then(resolve, reject);
        }
      };
      return query;
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

function syncOptions() {
  return {
    chatLoadBatchSize: 100,
    messageLimit: 100,
    requestDelayMs: 0,
    windowDays: 30
  };
}

function absoluteRange(): HistorySyncTarget['range'] {
  return {
    end: {
      at: '2026-06-12T00:00:00.000Z',
      kind: 'absolute'
    },
    start: {
      at: '2026-06-11T00:00:00.000Z',
      kind: 'absolute'
    }
  };
}

function relativeRange(): HistorySyncTarget['range'] {
  return {
    end: {
      expression: 'now-5m',
      kind: 'expression'
    },
    start: {
      expression: 'now-15m',
      kind: 'expression'
    }
  };
}

function selectRows(table: unknown, targets: unknown[]): unknown[] {
  if (table === historySyncTemplates) {
    return [];
  }
  if (table === historySyncTargets) {
    return targets;
  }
  throw new Error('Unexpected history controller test table selection');
}

function acceptedModes(events: PublishedEvent[]): unknown[] {
  return events
    .filter((event) => event.type === 'history-sync.sync.accepted')
    .map((event) =>
      typeof event.data === 'object' && event.data !== null && 'mode' in event.data
        ? event.data.mode
        : undefined
    );
}

function coverageChatId(input: unknown): string {
  if (typeof input !== 'object' || input === null || !('chatId' in input)) {
    throw new Error('Coverage request is missing chatId');
  }
  const chatId = input.chatId;
  if (typeof chatId !== 'string') {
    throw new Error('Coverage request chatId must be a string');
  }
  return chatId;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return {
    promise,
    resolve
  };
}
