import { createIntegrationEvent, type IntegrationEvent } from '@agentg/events/envelope';

import type { SummaryInvalidation, SummaryResult, SummaryRun } from './types.js';

export function createSummaryRequestedEvent(run: SummaryRun): IntegrationEvent {
  return createIntegrationEvent({
    data: {
      chatId: run.chatId,
      reason: run.reason,
      runId: run.id
    },
    meta: {
      chatId: run.chatId,
      runId: run.id
    },
    type: 'summaries.summary.requested'
  });
}

export function createSummaryCompletedEvent(input: {
  result: SummaryResult;
  run: SummaryRun;
}): IntegrationEvent {
  return createIntegrationEvent({
    data: {
      chatId: input.run.chatId,
      resultId: input.result.id,
      runId: input.run.id,
      sourceReferences: input.result.sourceReferences.length
    },
    meta: {
      chatId: input.run.chatId,
      resultId: input.result.id,
      runId: input.run.id
    },
    type: 'summaries.summary.completed'
  });
}

export function createSummaryInvalidatedEvent(invalidation: SummaryInvalidation): IntegrationEvent {
  return createIntegrationEvent({
    data: {
      chatId: invalidation.chatId,
      reason: invalidation.reason
    },
    meta: {
      chatId: invalidation.chatId,
      reason: invalidation.reason
    },
    type: 'summaries.summary.invalidated'
  });
}
