import type { EventBus, EventSubscription } from '../bus/eventBus.js';
import { createAppEvent, type AppEvent } from '../bus/events.js';
import type { TelegramService } from '../telegram/telegramService.js';
import type { HistoryCoverageInterval } from './coverage.js';
import { liveMessageCoverageInterval } from './coverage.js';
import type { HistoryJob } from './jobs.js';
import type { HistoryMessage, HistoryRepository } from './historyRepository.js';
import { reconcileChat, type HistoryTarget } from './reconciler.js';

export type HistoryService = {
  createBackfillJobs(input: CreateBackfillJobsInput): HistoryJob[];
  getCoverage(chatId: string): HistoryCoverageInterval[];
  listMessages(chatId: string): HistoryMessage[];
  start(): void;
  stop(): void;
};

export type HistoryServiceDependencies = {
  eventBus: EventBus;
  repository: HistoryRepository;
  telegramService: TelegramService;
};

export type CreateBackfillJobsInput = {
  chatId: string;
  targets: HistoryTarget[];
  jobWindowMilliseconds?: number;
};

export function createHistoryService(dependencies: HistoryServiceDependencies): HistoryService {
  let subscriptions: EventSubscription[] = [];

  return {
    createBackfillJobs(input): HistoryJob[] {
      const coverage = dependencies.repository.listCoverage(input.chatId);
      const jobs = reconcileChat({
        chatId: input.chatId,
        coverage,
        ...(input.jobWindowMilliseconds === undefined
          ? {}
          : { jobWindowMilliseconds: input.jobWindowMilliseconds }),
        targets: input.targets
      });

      return dependencies.repository.createJobs(jobs);
    },
    getCoverage(chatId): HistoryCoverageInterval[] {
      return dependencies.repository.listCoverage(chatId);
    },
    listMessages(chatId): HistoryMessage[] {
      return dependencies.repository.listMessages(chatId);
    },
    start(): void {
      if (subscriptions.length > 0) {
        return;
      }

      subscriptions = [
        dependencies.eventBus.subscribe('telegram.message.created', (event) =>
          recordTelegramMessageEvent(dependencies, event)
        ),
        dependencies.eventBus.subscribe('telegram.message.updated', (event) =>
          recordTelegramMessageEvent(dependencies, event)
        )
      ];
    },
    stop(): void {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
      subscriptions = [];
    }
  };
}

async function recordTelegramMessageEvent(
  dependencies: HistoryServiceDependencies,
  event: AppEvent
): Promise<void> {
  const messageReference = readTelegramMessageReference(event);
  if (messageReference === undefined) {
    return;
  }

  const message = await dependencies.telegramService.getMessage(
    messageReference.chatId,
    messageReference.messageId
  );
  if (message?.messageDate === undefined) {
    return;
  }

  const observedAt = new Date(event.occurredAt);
  const recorded = dependencies.repository.recordTelegramMessage(message, observedAt);
  const coverage = dependencies.repository.addCoverage(
    liveMessageCoverageInterval({
      chatId: message.chatId,
      messageDate: new Date(message.messageDate),
      observedUntil: observedAt
    })
  );

  if (recorded !== undefined) {
    await dependencies.eventBus.publish(
      createAppEvent({
        data: {
          chatId: recorded.chatId,
          messageId: recorded.messageId
        },
        meta: {
          chatId: recorded.chatId,
          messageId: recorded.messageId
        },
        source: 'history',
        type: 'history.message.recorded'
      })
    );
  }

  await dependencies.eventBus.publish(
    createAppEvent({
      data: {
        chatId: message.chatId,
        intervalCount: coverage.length
      },
      meta: {
        chatId: message.chatId
      },
      source: 'history',
      type: 'history.coverage.changed'
    })
  );
}

function readTelegramMessageReference(event: AppEvent):
  | {
      chatId: string;
      messageId: string;
    }
  | undefined {
  const meta = event.meta;
  if (typeof meta?.chatId === 'string' && typeof meta.messageId === 'string') {
    return {
      chatId: meta.chatId,
      messageId: meta.messageId
    };
  }

  const message = readRecord(event.data.message);
  if (typeof message?.chatId === 'string' && typeof message.messageId === 'string') {
    return {
      chatId: message.chatId,
      messageId: message.messageId
    };
  }

  return undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
