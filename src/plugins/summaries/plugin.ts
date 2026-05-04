import type { EventSubscription } from '../../bus/eventBus.js';
import { createAppEvent, type AppEvent } from '../../bus/events.js';
import type { PluginContext, TrustedPlugin } from '../types.js';
import type { SummariesRepository } from './repository.js';
import type { SummaryReadResult, SummaryRequest, SummaryRequestResult } from './types.js';

export type SummariesPlugin = TrustedPlugin & {
  readChatSummary(chatId: string): SummaryReadResult;
  requestChatSummary(input: SummaryRequest): SummaryRequestResult;
};

export type SummariesPluginOptions = {
  now?: () => Date;
  repository: SummariesRepository;
};

export function createSummariesPlugin(options: SummariesPluginOptions): SummariesPlugin {
  let context: PluginContext | undefined;
  let subscriptions: EventSubscription[] = [];

  return {
    name: 'summaries',
    readChatSummary(chatId): SummaryReadResult {
      return options.repository.readChatSummary(chatId);
    },
    requestChatSummary(input): SummaryRequestResult {
      if (context === undefined) {
        throw new Error('Summaries plugin is not started');
      }

      const result = options.repository.requestSummary(
        input,
        context.historyService.listMessages(input.chatId),
        options.now?.() ?? new Date()
      );

      void context.eventBus.publish(
        createAppEvent({
          data: {
            chatId: result.run.chatId,
            reason: result.run.reason,
            runId: result.run.id
          },
          meta: {
            chatId: result.run.chatId,
            runId: result.run.id
          },
          source: 'summaries',
          type: 'summaries.summary.requested'
        })
      );
      void context.eventBus.publish(
        createAppEvent({
          data: {
            chatId: result.run.chatId,
            resultId: result.summary.id,
            runId: result.run.id,
            sourceReferences: result.summary.sourceReferences.length
          },
          meta: {
            chatId: result.run.chatId,
            resultId: result.summary.id,
            runId: result.run.id
          },
          source: 'summaries',
          type: 'summaries.summary.completed'
        })
      );

      return result;
    },
    start(pluginContext): void {
      if (subscriptions.length > 0) {
        return;
      }

      context = pluginContext;
      subscriptions = [
        pluginContext.eventBus.subscribe('telegram.message.created', (event) =>
          handleSummariesEvent(options.repository, pluginContext, event)
        ),
        pluginContext.eventBus.subscribe('telegram.message.updated', (event) =>
          handleSummariesEvent(options.repository, pluginContext, event)
        ),
        pluginContext.eventBus.subscribe('telegram.message.deleted', (event) =>
          handleSummariesEvent(options.repository, pluginContext, event)
        ),
        pluginContext.eventBus.subscribe('history.coverage.changed', (event) =>
          handleSummariesEvent(options.repository, pluginContext, event)
        )
      ];
    },
    stop(): void {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
      subscriptions = [];
      context = undefined;
    }
  };
}

async function handleSummariesEvent(
  repository: SummariesRepository,
  context: PluginContext,
  event: AppEvent
): Promise<void> {
  const chatId = chatIdFromEvent(event);
  const reason = invalidationReason(event.type);
  if (chatId === undefined || reason === undefined) {
    return;
  }

  const invalidation = repository.recordInvalidation({
    chatId,
    eventId: event.id,
    invalidatedAt: new Date(event.occurredAt),
    reason
  });

  await context.eventBus.publish(
    createAppEvent({
      data: {
        chatId: invalidation.chatId,
        reason: invalidation.reason
      },
      meta: {
        chatId: invalidation.chatId,
        reason: invalidation.reason
      },
      source: 'summaries',
      type: 'summaries.summary.invalidated'
    })
  );
}

function invalidationReason(eventType: string): string | undefined {
  switch (eventType) {
    case 'telegram.message.created':
    case 'telegram.message.updated':
    case 'telegram.message.deleted':
      return 'telegram-message-changed';
    case 'history.coverage.changed':
      return 'history-state-changed';
    default:
      return undefined;
  }
}

function chatIdFromEvent(event: AppEvent): string | undefined {
  if (typeof event.meta?.chatId === 'string') {
    return event.meta.chatId;
  }

  const message = readRecord(event.data.message);
  if (typeof message?.chatId === 'string') {
    return message.chatId;
  }

  const deleted = readRecord(event.data.delete);
  if (typeof deleted?.chatId === 'string') {
    return deleted.chatId;
  }

  return typeof event.data.chatId === 'string' ? event.data.chatId : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
