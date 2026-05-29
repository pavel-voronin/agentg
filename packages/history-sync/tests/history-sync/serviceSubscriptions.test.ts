import type { EventBus, EventSubscription } from '@agentg/events/bus';
import type { IntegrationEvent } from '@agentg/events/envelope';
import { describe, expect, it, vi } from 'vitest';

import { subscribeHistorySyncService } from '../../src/service/runService.js';

describe('history sync service subscriptions', () => {
  it('does not request a sync pass from Telegram coverage changes', () => {
    const request = vi.fn();
    const subscriptions = new Map<string, (event: IntegrationEvent) => void | Promise<void>>();

    subscribeHistorySyncService({
      controller: {
        request,
        stop() {
          return;
        },
        wait() {
          return Promise.resolve();
        }
      },
      eventBus: recordingEventBus(subscriptions)
    });

    expect([...subscriptions.keys()].sort()).toEqual([
      'telegram.chat.removed',
      'telegram.chat.updated'
    ]);
    expect(subscriptions.has('telegram.history.coverage.changed')).toBe(false);
  });
});

function recordingEventBus(
  subscriptions: Map<string, (event: IntegrationEvent) => void | Promise<void>>
): EventBus {
  return {
    close(): Promise<void> {
      return Promise.resolve();
    },
    publish(): void {
      return;
    },
    subscribe(subject, handler): EventSubscription {
      subscriptions.set(subject, handler);
      return {
        unsubscribe(): void {
          subscriptions.delete(subject);
        }
      };
    }
  };
}
