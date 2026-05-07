import { createIntegrationEvent, type IntegrationEvent } from '@agentg/events/envelope';
import type { EventBus, EventSubscription } from '@agentg/events/bus';
import { describe, expect, it } from 'vitest';

import { createInMemorySummaryRepository } from '../src/memory-store.js';
import { handleSummariesEvent } from '../src/summary-service.js';

describe('summaries service', () => {
  it('stores private summary state and invalidates it from Telegram events', async () => {
    const events: IntegrationEvent[] = [];
    const runtime = {
      eventBus: createCapturingEventBus(events),
      now: () => new Date('2026-05-02T00:00:00.000Z'),
      repository: createInMemorySummaryRepository()
    };

    const requested = await runtime.repository.requestSummary(
      {
        chatId: 'chat-a',
        reason: 'manual',
        sourceMessages: [
          {
            messageDate: '2026-05-01T00:00:00.000Z',
            messageId: '42'
          }
        ]
      },
      runtime.now()
    );

    expect(requested.summary).toMatchObject({
      chatId: 'chat-a',
      sourceReferences: [
        {
          messageDate: '2026-05-01T00:00:00.000Z',
          messageId: '42'
        }
      ]
    });

    await handleSummariesEvent(
      runtime,
      createIntegrationEvent({
        data: {
          message: {
            _model: 'telegram.message',
            id: 'chat-a:43',
            chat: {
              _model: 'telegram.chat',
              id: 'chat-a'
            },
            telegramMessageId: '43'
          }
        },
        source: 'telegram',
        type: 'telegram.message.created'
      })
    );

    await expect(runtime.repository.readChatSummary('chat-a')).resolves.toMatchObject({
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
