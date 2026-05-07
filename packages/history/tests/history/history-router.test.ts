import type { HistoryDatabase as AppDatabase } from '../../src/database.js';
import type { EventBus, EventSubscription } from '@agentg/events/bus';
import type { IntegrationEvent } from '@agentg/events/envelope';
import { describe, expect, it } from 'vitest';

import { createHistoryRouter } from '../../src/rpc/router.js';

describe('createHistoryRouter', () => {
  it('applies call-scoped event suppression to History domain fact events', async () => {
    const publishedEvents: IntegrationEvent[] = [];
    const eventBus = createRecordingEventBus(publishedEvents);
    const router = createHistoryRouter({
      database: {} as AppDatabase,
      eventBus
    });

    await expect(
      router.createCaller({ callOptions: { observable: false }, eventBus }).requestSync({})
    ).resolves.toEqual({
      requested: true
    });
    expect(publishedEvents.map((event) => event.type)).toEqual(['history.sync.requested']);

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
