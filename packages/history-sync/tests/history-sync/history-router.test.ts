import type { HistoryDatabase as AppDatabase } from '../../src/database.js';
import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/shared/events/envelope';
import { createExtensionRegistry } from '@agentg/shared/rpc/extensions';
import { describe, expect, it } from 'vitest';

import { createHistoryRouter, type HistoryMethodCaller } from '../../src/rpc/history-router.js';

describe('createHistoryRouter', () => {
  it('normalizes History reads and commands through tRPC procedures', async () => {
    const calls: { method: string; params: unknown }[] = [];
    const callMethod: HistoryMethodCaller = (_runtime, method, params) => {
      calls.push({ method, params });

      if (method === 'history.getOverview') {
        return Promise.resolve({
          activeJob: {
            chatId: 'chat-a',
            endAt: new Date('2026-04-30T02:00:00.000Z'),
            startAt: new Date('2026-04-30T01:00:00.000Z'),
            status: 'running'
          },
          chats: 1,
          coverageIntervals: 2,
          pendingJobs: 0,
          runningJobs: 1,
          targets: 1,
          templates: 1
        });
      }

      if (method === 'history.upsertTarget') {
        return Promise.resolve({
          target: {
            chatId: 'chat-a',
            id: 'target-a',
            range: {
              end: { expression: 'now', kind: 'expression' },
              start: { expression: 'now-7d', kind: 'expression' }
            }
          },
          upserted: true
        });
      }

      return Promise.resolve(undefined);
    };
    const caller = createHistoryRouter({
      callMethod,
      database: {} as AppDatabase,
      eventBus: {} as EventBus
    }).createCaller({});

    await expect(caller.getOverview(undefined)).resolves.toEqual({
      activeJob: {
        chatId: 'chat-a',
        endAt: '2026-04-30T02:00:00.000Z',
        startAt: '2026-04-30T01:00:00.000Z',
        status: 'running'
      },
      chats: 1,
      coverageIntervals: 2,
      pendingJobs: 0,
      runningJobs: 1,
      targets: 1,
      templates: 1
    });

    await expect(
      caller.upsertTarget({
        chatId: 'chat-a',
        preset: 'last7d'
      })
    ).resolves.toEqual({
      deleted: false,
      target: {
        chatId: 'chat-a',
        id: 'target-a',
        range: {
          end: { expression: 'now', kind: 'expression' },
          start: { expression: 'now-7d', kind: 'expression' }
        }
      },
      upserted: true
    });

    expect(calls).toEqual([
      { method: 'history.getOverview', params: undefined },
      { method: 'history.upsertTarget', params: { chatId: 'chat-a', preset: 'last7d' } }
    ]);
  });

  it('registers extensions through the runtime RPC method', async () => {
    const extensionRegistry = createExtensionRegistry({ ttlMs: 60000 });
    const caller = createHistoryRouter({
      callMethod: () => Promise.resolve(undefined),
      database: {} as AppDatabase,
      eventBus: {} as EventBus,
      extensionRegistry
    }).createCaller({});

    await expect(
      caller.registerExtension({
        extension: 'summaries.chatSummary',
        target: 'history.getChatHistoryState'
      })
    ).resolves.toMatchObject({
      extension: 'summaries.chatSummary',
      refreshed: false,
      registered: true,
      target: 'history.getChatHistoryState'
    });

    await expect(
      caller.registerExtension({
        extension: 'summaries.chatSummary',
        target: 'history.getChatHistoryState'
      })
    ).resolves.toMatchObject({
      extension: 'summaries.chatSummary',
      refreshed: true,
      registered: false,
      target: 'history.getChatHistoryState'
    });

    expect(extensionRegistry.list('history.getChatHistoryState')).toHaveLength(1);

    await expect(caller.listExtensions()).resolves.toMatchObject({
      extensions: [
        {
          extension: 'summaries.chatSummary',
          slug: 'summaries',
          target: 'history.getChatHistoryState'
        }
      ]
    });
  });

  it('applies call-scoped event suppression to History domain fact events', async () => {
    const publishedEvents: IntegrationEvent[] = [];
    const eventBus = createRecordingEventBus(publishedEvents);
    const callMethod: HistoryMethodCaller = (runtime) => {
      runtime.eventBus.publish(
        createIntegrationEvent({
          data: {
            requested: true
          },
          source: 'history-sync',
          type: 'history.fact.requested'
        })
      );
      return Promise.resolve({
        requested: true
      });
    };
    const router = createHistoryRouter({
      callMethod,
      database: {} as AppDatabase,
      eventBus
    });

    await expect(
      router.createCaller({ callOptions: { observable: false }, eventBus }).requestSync({})
    ).resolves.toEqual({
      requested: true
    });
    expect(publishedEvents.map((event) => event.type)).toEqual(['history.fact.requested']);

    publishedEvents.length = 0;

    await expect(
      router.createCaller({ callOptions: { silent: true }, eventBus }).requestSync({})
    ).resolves.toEqual({
      requested: true
    });
    expect(publishedEvents).toEqual([]);
  });
});

function createRecordingEventBus(events: IntegrationEvent[]): EventBus {
  return {
    close(): Promise<void> {
      return Promise.resolve();
    },
    publish(event): void {
      events.push(event);
    },
    subscribe(): EventSubscription {
      return {
        unsubscribe(): void {
          return;
        }
      };
    }
  };
}
