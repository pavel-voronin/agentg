import type { EventBus, EventSubscription } from '@agentg/framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../src/database/client.js';
import { historySyncTargets, historySyncTemplates } from '../src/database/schema.js';
import type { TelegramHistoryClient } from '../src/model/types.js';

const telemetry = vi.hoisted(() => ({
  incrementTelemetryCounter: vi.fn(),
  setTelemetryGauge: vi.fn(),
  spans: [] as unknown[],
  timeTelemetrySpan: vi.fn((input: unknown, operation: () => Promise<unknown>) => {
    telemetry.spans.push(input);
    return operation();
  })
}));

vi.mock('@agentg/framework', async (importOriginal) => {
  const module = await importOriginal<typeof import('@agentg/framework')>();
  return {
    ...module,
    incrementTelemetryCounter: telemetry.incrementTelemetryCounter,
    setTelemetryGauge: telemetry.setTelemetryGauge,
    timeTelemetrySpan: telemetry.timeTelemetrySpan
  };
});

describe('history sync telemetry', () => {
  beforeEach(() => {
    telemetry.incrementTelemetryCounter.mockReset();
    telemetry.setTelemetryGauge.mockReset();
    telemetry.spans.length = 0;
    telemetry.timeTelemetrySpan.mockClear();
  });

  it('records controller pass duration without raw manual reason values', async () => {
    const { createController } = await import('../src/sync/controller.js');
    const controller = createController(
      createFakeHistorySyncDatabase() as unknown as Database,
      createFakeTelegramHistoryClient(),
      createFakeEventBus(),
      {
        chatLoadBatchSize: 100,
        discoverChats: false,
        messageLimit: 100,
        requestDelayMs: 0,
        windowDays: 30
      }
    );

    controller.request('manual:secret-chat-id');
    await controller.wait();

    expect(telemetry.spans).toContainEqual({
      attributes: {
        'history_sync.controller.reason': 'manual'
      },
      metric: {
        attributes: {
          'history_sync.controller.reason': 'manual'
        },
        name: 'history_sync.controller.pass.duration'
      },
      name: 'history_sync.controller.pass'
    });
    expect(JSON.stringify(telemetry.spans)).not.toContain('secret-chat-id');
  });

  it('records sync stage duration and workload metrics with bounded labels', async () => {
    const { runHistorySync } = await import('../src/sync/executor.js');

    await runHistorySync(
      createFakeHistorySyncDatabase() as unknown as Database,
      createFakeTelegramHistoryClient(),
      createFakeEventBus(),
      {
        chatLoadBatchSize: 50,
        discoverChats: true,
        messageLimit: 100,
        requestDelayMs: 0,
        windowDays: 7
      }
    );

    const stageSpans = telemetry.spans.filter((span) =>
      JSON.stringify(span).includes('history_sync.sync.stage.duration')
    );
    const stageNames = stageSpans.map(spanName);

    expect(stageSpans.find((span) => spanName(span) === 'history_sync.sync.list_chats')).toEqual({
      attributes: {
        'history_sync.chat.load_batch_size': 50,
        'history_sync.discovery.enabled': true,
        'history_sync.sync.stage': 'list_chats'
      },
      metric: {
        attributes: {
          'history_sync.sync.stage': 'list_chats'
        },
        name: 'history_sync.sync.stage.duration'
      },
      name: 'history_sync.sync.list_chats'
    });
    expect(
      stageSpans.find((span) => spanName(span) === 'history_sync.sync.request_coverage')
    ).toEqual({
      attributes: {
        'history_sync.chat.count': 1,
        'history_sync.sync.stage': 'request_coverage',
        'history_sync.sync.window_days': 7,
        'history_sync.target.count': 0
      },
      metric: {
        attributes: {
          'history_sync.sync.stage': 'request_coverage'
        },
        name: 'history_sync.sync.stage.duration'
      },
      name: 'history_sync.sync.request_coverage'
    });
    expect(stageNames).not.toContain('history_sync.sync.cleanup_one_shot_targets');
    for (const span of stageSpans) {
      const metric = (span as { metric?: { attributes?: Record<string, unknown> } }).metric;
      expect(Object.keys(metric?.attributes ?? {})).toEqual(['history_sync.sync.stage']);
    }
    expect(telemetry.setTelemetryGauge.mock.calls).toEqual([
      ['history_sync.sync.last_completed.unix_seconds', expect.any(Number)],
      ['history_sync.sync.last_chats', 1],
      ['history_sync.sync.last_targets', 0],
      ['history_sync.sync.last_pages', 0],
      ['history_sync.sync.last_fetched_messages', 0],
      ['history_sync.sync.last_stored_messages', 0],
      ['history_sync.sync.last_covered_intervals', 0],
      ['history_sync.sync.last_remaining_intervals', 0]
    ]);
    expect(telemetry.incrementTelemetryCounter.mock.calls).toEqual([
      ['history_sync.sync.pages', 0],
      ['history_sync.sync.messages.fetched', 0],
      ['history_sync.sync.messages.stored', 0],
      ['history_sync.sync.covered_intervals', 0]
    ]);
    expect(JSON.stringify(stageSpans)).not.toContain('secret-chat-id');
    expect(JSON.stringify(telemetry.setTelemetryGauge.mock.calls)).not.toContain('secret-chat-id');
    expect(JSON.stringify(telemetry.incrementTelemetryCounter.mock.calls)).not.toContain(
      'secret-chat-id'
    );
  });

  it('records coverage work stages without per-chat or interval cardinality attributes', async () => {
    const { runHistorySync } = await import('../src/sync/executor.js');

    await runHistorySync(
      createFakeHistorySyncDatabase({
        targets: [
          {
            id: 'secret-target-id',
            range: {
              end: {
                at: '2026-06-02T00:00:00.000Z',
                kind: 'absolute'
              },
              start: {
                at: '2026-06-01T00:00:00.000Z',
                kind: 'absolute'
              }
            },
            telegramChatId: 'secret-chat-id',
            templateId: null
          }
        ]
      }) as unknown as Database,
      createFakeTelegramHistoryClient(),
      createFakeEventBus(),
      {
        chatLoadBatchSize: 50,
        discoverChats: true,
        messageLimit: 100,
        requestDelayMs: 0,
        windowDays: 7
      }
    );

    const stageSpans = telemetry.spans.filter((span) =>
      JSON.stringify(span).includes('history_sync.sync.stage.duration')
    );
    const stageNames = stageSpans.map(spanName);

    expect(stageNames).toContain('history_sync.sync.request_interval');
    expect(stageNames).toContain('history_sync.sync.cleanup_one_shot_targets');
    expect(stageNames).not.toContain('history_sync.sync.project_intervals');
    for (const span of stageSpans) {
      const metric = (span as { metric?: { attributes?: Record<string, unknown> } }).metric;
      expect(Object.keys(metric?.attributes ?? {})).toEqual(['history_sync.sync.stage']);
    }

    const telemetryPayload = JSON.stringify(stageSpans);
    expect(telemetryPayload).not.toContain('secret-chat-id');
    expect(telemetryPayload).not.toContain('secret-target-id');
    expect(telemetryPayload).not.toContain('history_sync.chat.index');
    expect(telemetryPayload).not.toContain('history_sync.interval.index');
    expect(telemetryPayload).not.toContain('history_sync.interval.duration_seconds');
  });
});

type PublishedEvent = {
  data?: unknown;
  type: string;
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
    listChats: vi.fn(() =>
      Promise.resolve([
        {
          id: 'secret-chat-id',
          title: 'Private Chat',
          type: 'private'
        }
      ])
    )
  };
}

function createFakeHistorySyncDatabase(
  options: {
    targets?: unknown[];
    templates?: unknown[];
  } = {}
) {
  const targets = options.targets ?? [];
  const templates = options.templates ?? [];
  return {
    insert() {
      const query = {
        onConflictDoUpdate() {
          return Promise.resolve();
        },
        values() {
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
          return Promise.resolve(selectRows(selectedTable, { targets, templates })).then(
            resolve,
            reject
          );
        }
      };
      return query;
    }
  };
}

function selectRows(
  table: unknown,
  rows: {
    targets: unknown[];
    templates: unknown[];
  }
): unknown[] {
  if (table === historySyncTemplates) {
    return rows.templates;
  }
  if (table === historySyncTargets) {
    return rows.targets;
  }
  throw new Error('Unexpected history telemetry test table selection');
}

function spanName(span: unknown): string | undefined {
  if (typeof span !== 'object' || span === null || !('name' in span)) {
    return undefined;
  }
  return typeof span.name === 'string' ? span.name : undefined;
}
