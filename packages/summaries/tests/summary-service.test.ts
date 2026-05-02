import { createIntegrationEvent, type IntegrationEvent } from '@agentg/shared/events/envelope';
import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import { describe, expect, it } from 'vitest';

import { createInMemorySummaryRepository } from '../src/memory-store.js';
import {
  getChatSummaryExtension,
  handleSummariesEvent,
  requestChatSummary
} from '../src/summary-service.js';

describe('summaries service', () => {
  it('stores private summary state and invalidates it from Telegram events', async () => {
    const events: IntegrationEvent[] = [];
    const runtime = {
      eventBus: createCapturingEventBus(events),
      now: () => new Date('2026-05-02T00:00:00.000Z'),
      repository: createInMemorySummaryRepository()
    };

    const requested = await requestChatSummary(runtime, {
      chatId: 'chat-a',
      reason: 'manual',
      sourceMessages: [
        {
          messageDate: '2026-05-01T00:00:00.000Z',
          messageId: '42'
        }
      ]
    });

    expect(requested.summary).toMatchObject({
      chatId: 'chat-a',
      sourceReferences: [
        {
          messageDate: '2026-05-01T00:00:00.000Z',
          messageId: '42'
        }
      ]
    });
    expect(events.map((event) => event.type)).toEqual([
      'summaries.summary.requested',
      'summaries.summary.completed'
    ]);

    await handleSummariesEvent(
      runtime,
      createIntegrationEvent({
        data: {
          message: {
            chatId: 'chat-a',
            messageId: '43'
          }
        },
        source: 'telegram',
        type: 'telegram.message.created'
      })
    );

    await expect(getChatSummaryExtension(runtime, 'chat-a')).resolves.toMatchObject({
      stale: true,
      summary: {
        chatId: 'chat-a'
      },
      invalidation: {
        chatId: 'chat-a',
        reason: 'telegram-message-changed'
      }
    });
    expect(events.at(-1)?.type).toBe('summaries.summary.invalidated');
  });
});

function createCapturingEventBus(events: IntegrationEvent[]): EventBus {
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
