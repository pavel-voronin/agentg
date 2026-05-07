import type { IntegrationEvent } from '@agentg/events/envelope';

import { createSummaryInvalidatedEvent } from './events.js';
import type { SummariesRuntime } from './runtime.js';
import type { SummaryInvalidation } from './types.js';

export async function handleSummariesEvent(
  runtime: SummariesRuntime,
  event: IntegrationEvent
): Promise<SummaryInvalidation | undefined> {
  const chatId = chatIdFromEvent(event);
  if (chatId === undefined) {
    return undefined;
  }

  const reason = invalidationReason(event.type);
  if (reason === undefined) {
    return undefined;
  }

  const invalidation = await runtime.repository.recordInvalidation({
    chatId,
    eventId: event.id,
    invalidatedAt: new Date(event.occurredAt),
    reason
  });
  runtime.eventBus.publish(createSummaryInvalidatedEvent(invalidation));

  return invalidation;
}

function invalidationReason(eventType: string): string | undefined {
  switch (eventType) {
    case 'telegram.message.created':
    case 'telegram.message.updated':
    case 'telegram.message.deleted':
      return 'telegram-message-changed';
    case 'history.coverage.changed':
    case 'history.target.deleted':
    case 'history.target.upserted':
      return 'history-state-changed';
    default:
      return undefined;
  }
}

function chatIdFromEvent(event: IntegrationEvent): string | undefined {
  switch (event.type) {
    case 'telegram.message.created':
    case 'telegram.message.updated':
      return chatIdFromTelegramMessage(asRecord(event.data.message));
    case 'telegram.message.deleted':
      return chatIdFromTelegramMessageDelete(asRecord(event.data.delete));
    case 'history.coverage.changed':
    case 'history.target.deleted':
    case 'history.target.upserted':
      return chatIdFromHistoryEvent(event.data);
    default:
      return undefined;
  }
}

function chatIdFromTelegramMessage(
  message: Record<string, unknown> | undefined
): string | undefined {
  const chat = asRecord(message?.chat);
  return chat?._model === 'telegram.chat' && typeof chat.id === 'string' ? chat.id : undefined;
}

function chatIdFromTelegramMessageDelete(
  deleted: Record<string, unknown> | undefined
): string | undefined {
  const chat = asRecord(deleted?.chat);
  return chat?._model === 'telegram.chat' && typeof chat.id === 'string' ? chat.id : undefined;
}

function chatIdFromHistoryEvent(data: Record<string, unknown>): string | undefined {
  const target = asRecord(data.target);
  if (typeof target?.chatId === 'string') {
    return target.chatId;
  }
  return typeof data.chatId === 'string' ? data.chatId : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
