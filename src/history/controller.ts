import type { EventBus } from '../bus/eventBus.js';
import { createAppEvent } from '../bus/events.js';
import type { TelegramService } from '../telegram/telegramService.js';
import { runHistorySync } from './executor.js';
import type { HistoryRepository } from './historyRepository.js';

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
  repository: HistoryRepository,
  telegramService: TelegramService,
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
        await eventBus.publish(
          createAppEvent({
            data: { reason: currentReason },
            source: 'history',
            type: 'history.sync.accepted'
          })
        );
        await runHistorySync(repository, telegramService, {
          chatLoadBatchSize: options.chatLoadBatchSize,
          discoverChats: shouldDiscoverChats(currentReason),
          jobWindowDays: options.windowDays,
          messageLimit: options.messageLimit,
          publishEvent(event) {
            return eventBus.publish(event);
          },
          requestDelayMs: options.requestDelayMs
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
          await eventBus.publish(
            createAppEvent({
              data: {
                error: message,
                reason: currentReason
              },
              source: 'history',
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

function shouldDiscoverChats(reason: string): boolean {
  return reason === 'startup' || reason === 'tdlib-connected';
}
