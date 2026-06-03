import type { EventBus } from '@agentg/framework';

import { runHistorySync, type SyncOptions } from './executor.js';
import type { Database } from '../database/client.js';
import type { TelegramHistoryClient } from '../model/types.js';

export type Controller = {
  request(reason: string): void;
  stop(): void;
  wait(): Promise<void>;
};

const RETRY_DELAY_MS = 5000;

export function createController(
  database: Database,
  telegram: TelegramHistoryClient,
  events: EventBus,
  options: SyncOptions
): Controller {
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

  async function runLoop(initialReason: string): Promise<void> {
    let reason = initialReason;
    while (requested && !stopped) {
      requested = false;
      const currentReason = reason;
      let nextReason = 'queued';
      try {
        events.publish('history-sync.sync.accepted', {
          reason: currentReason
        });
        await runHistorySync(database, telegram, events, {
          ...options,
          discoverChats: currentReason === 'startup'
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          JSON.stringify({
            error: message,
            event: 'history-sync.failed_pass'
          })
        );
        events.publish('history-sync.sync.failed', {
          error: message,
          reason: currentReason
        });
        if (await delayUnlessStopped(RETRY_DELAY_MS)) {
          requested = true;
          nextReason = 'retry';
        }
      }
      reason = nextReason;
    }
  }

  async function delayUnlessStopped(milliseconds: number): Promise<boolean> {
    if (milliseconds <= 0 || stopped) {
      return false;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, milliseconds);
      wakeRetryDelay = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
    wakeRetryDelay = undefined;
    return !stopped;
  }

  return {
    request,
    stop() {
      stopped = true;
      requested = false;
      wakeRetryDelay?.();
    },
    async wait() {
      await currentTask;
    }
  };
}
