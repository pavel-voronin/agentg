import type { AppDatabase } from '@agentg/database/client';
import type { EventBus } from '@agentg/shared/events/bus';
import { createIntegrationEvent } from '@agentg/shared/events/envelope';

import { runHistorySync } from './executor.js';
import type { TelegramHistoryClient } from './telegram-client.js';

export type BackfillOptions = {
  chatLoadBatchSize: number;
  messageLimit: number;
  requestDelayMs: number;
  windowDays: number;
};

export type HistorySyncController = {
  request(reason: string): void;
  stop(): void;
  wait(): Promise<void>;
};

const HISTORY_SYNC_RETRY_DELAY_MS = 5000;

export function createHistorySyncController(
  database: AppDatabase,
  client: TelegramHistoryClient,
  options: BackfillOptions,
  eventBus: EventBus,
  isShuttingDown: () => boolean
): HistorySyncController {
  let currentTask: Promise<void> | undefined;
  let requested = false;
  let stopped = false;
  let wakeRetryDelay: (() => void) | undefined;

  const request = (reason: string): void => {
    if (stopped) {
      return;
    }

    requested = true;
    currentTask ??= runLoop(reason).finally(() => {
      currentTask = undefined;
    });
  };

  const runLoop = async (initialReason: string): Promise<void> => {
    let reason = initialReason;
    while (requested && !stopped) {
      requested = false;
      const currentReason = reason;
      let nextReason = 'queued';
      try {
        eventBus.publish(
          createIntegrationEvent({
            data: { reason: currentReason },
            source: 'history-sync',
            type: 'history.sync.accepted'
          })
        );
        await runHistorySyncPass(database, client, options, eventBus, {
          discoverChats: shouldDiscoverChats(currentReason)
        });
      } catch (error) {
        if (!isShuttingDown()) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(
            JSON.stringify({
              error: message,
              event: 'history_sync.failed_pass'
            })
          );
          eventBus.publish(
            createIntegrationEvent({
              data: {
                error: message,
                reason: currentReason
              },
              source: 'history-sync',
              type: 'history.sync.failed'
            })
          );
          const shouldRetry = await delayUnlessStopped(HISTORY_SYNC_RETRY_DELAY_MS);
          if (shouldRetry) {
            requested = true;
            nextReason = 'retry';
          }
        }
      }
      reason = nextReason;
    }
  };

  const delayUnlessStopped = async (milliseconds: number): Promise<boolean> => {
    if (milliseconds <= 0 || stopped) {
      return false;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, milliseconds);
      wakeRetryDelay = (): void => {
        clearTimeout(timeout);
        resolve();
      };
    });
    wakeRetryDelay = undefined;
    return !stopped;
  };

  return {
    request,
    stop(): void {
      stopped = true;
      requested = false;
      wakeRetryDelay?.();
    },
    async wait(): Promise<void> {
      await currentTask;
    }
  };
}

async function runHistorySyncPass(
  database: AppDatabase,
  client: TelegramHistoryClient,
  options: BackfillOptions,
  eventBus: EventBus,
  passOptions: {
    discoverChats: boolean;
  }
): Promise<void> {
  await runHistorySync(database, client, {
    chatLoadBatchSize: options.chatLoadBatchSize,
    discoverChats: passOptions.discoverChats,
    jobWindowDays: options.windowDays,
    messageLimit: options.messageLimit,
    publishEvent: (event) => {
      eventBus.publish(event);
    },
    requestDelayMs: options.requestDelayMs
  });
}

function shouldDiscoverChats(reason: string): boolean {
  return reason === 'startup';
}
