import type { EventBus } from '@agentg/shared/events/bus';
import type { IntegrationEvent } from '@agentg/shared/events/envelope';

import {
  createSummaryCompletedEvent,
  createSummaryInvalidatedEvent,
  createSummaryRequestedEvent
} from './events.js';
import type { SummaryRepository } from './store.js';
import type {
  SummaryExtensionResult,
  SummaryInvalidation,
  SummaryReadResult,
  SummaryRequest,
  SummaryRequestResult,
  SummaryRunReadResult
} from './types.js';

export type SummariesRuntime = {
  eventBus: EventBus;
  now?: (() => Date) | undefined;
  repository: SummaryRepository;
};

export async function requestChatSummary(
  runtime: SummariesRuntime,
  input: SummaryRequest
): Promise<SummaryRequestResult> {
  const now = runtime.now?.() ?? new Date();
  const result = await runtime.repository.requestSummary(input, now);

  runtime.eventBus.publish(createSummaryRequestedEvent(result.run));
  runtime.eventBus.publish(
    createSummaryCompletedEvent({
      result: result.summary,
      run: result.run
    })
  );

  return result;
}

export async function readChatSummary(
  runtime: Pick<SummariesRuntime, 'repository'>,
  chatId: string
): Promise<SummaryReadResult> {
  return runtime.repository.readChatSummary(chatId);
}

export async function readSummaryRun(
  runtime: Pick<SummariesRuntime, 'repository'>,
  runId: string
): Promise<SummaryRunReadResult> {
  return runtime.repository.readRun(runId);
}

export async function getChatSummaryExtension(
  runtime: Pick<SummariesRuntime, 'repository'>,
  chatId: string
): Promise<SummaryExtensionResult> {
  const result = await runtime.repository.readChatSummary(chatId);

  return {
    invalidation: result.invalidation,
    stale: result.invalidation !== null,
    summary: result.summary
  };
}

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
  if (typeof event.meta?.chatId === 'string') {
    return event.meta.chatId;
  }

  const data = event.data;
  const message = asRecord(data.message);
  if (typeof message?.chatId === 'string') {
    return message.chatId;
  }

  const deleted = asRecord(data.delete);
  if (typeof deleted?.chatId === 'string') {
    return deleted.chatId;
  }

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
