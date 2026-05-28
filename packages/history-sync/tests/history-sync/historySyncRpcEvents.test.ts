import type { HistorySyncDatabase as AppDatabase } from '../../src/database.js';
import type { EventBus, EventSubscription } from '@agentg/events/bus';
import type { IntegrationEvent } from '@agentg/events/envelope';
import { describe, expect, it } from 'vitest';

import { historySyncRpc } from '../../src/rpc/setup.js';

describe('History Sync RPC event behavior', () => {
  it('wakes History Sync directly and publishes a notification event for manual sync', async () => {
    const publishedEvents: IntegrationEvent[] = [];
    const syncRequests: { chatId?: string; reason: string }[] = [];
    const eventBus = createRecordingEventBus(publishedEvents);
    const router = historySyncRpc.createRouter({
      database: {} as AppDatabase,
      eventBus,
      requestSync(reason, chatId) {
        syncRequests.push({
          ...(chatId === undefined ? {} : { chatId }),
          reason
        });
      }
    });

    await expect(
      router.createCaller({ eventBus }).requestSync({
        chatId: 'chat-a'
      })
    ).resolves.toEqual({
      requested: true
    });

    expect(syncRequests).toEqual([
      {
        chatId: 'chat-a',
        reason: 'manual'
      }
    ]);
    expect(
      publishedEvents.filter((event) => event.type === 'history-sync.sync.requested')
    ).toMatchObject([
      {
        data: {
          chatId: 'chat-a',
          reason: 'manual'
        },
        type: 'history-sync.sync.requested'
      }
    ]);
  });
});

function createRecordingEventBus(publishedEvents: IntegrationEvent[]): EventBus {
  return {
    close(): Promise<void> {
      return Promise.resolve();
    },
    publish(event): void {
      publishedEvents.push(event);
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
