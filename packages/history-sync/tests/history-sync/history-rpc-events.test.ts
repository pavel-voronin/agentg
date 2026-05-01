import type { AppDatabase } from '@agentg/database/client';
import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import type { IntegrationEvent } from '@agentg/shared/events/envelope';
import { describe, expect, it } from 'vitest';

import { callHistoryMethod, type HistoryRuntime } from '../../src/observability.js';

describe('History RPC event behavior', () => {
  it('wakes History Sync directly and publishes a notification event for manual sync', async () => {
    const publishedEvents: IntegrationEvent[] = [];
    const syncRequests: { chatId?: string; reason: string }[] = [];
    const runtime: HistoryRuntime = {
      database: {} as AppDatabase,
      eventBus: createRecordingEventBus(publishedEvents),
      requestSync(reason, chatId) {
        syncRequests.push({
          ...(chatId === undefined ? {} : { chatId }),
          reason
        });
      }
    };

    await expect(
      callHistoryMethod(runtime, 'history.requestSync', {
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
    expect(publishedEvents).toMatchObject([
      {
        data: {
          chatId: 'chat-a',
          reason: 'manual'
        },
        source: 'history-sync',
        type: 'history.sync.requested'
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
