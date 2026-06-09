import {
  createLogger,
  logError,
  timeTelemetrySpan,
  type EventBus,
  type TelemetryAttributes
} from '@agentg/framework';

import { runHistorySync, type SyncOptions } from './executor.js';
import type { Database } from '../database/client.js';
import type { TelegramHistoryClient } from '../model/types.js';

export type Controller = {
  request(reason: string): void;
  stop(): void;
  wait(): Promise<void>;
};

const RETRY_DELAY_MS = 5000;
const METRIC_CONTROLLER_PASS_DURATION = 'history_sync.controller.pass.duration';
const logger = createLogger('history-sync');

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
        await timeControllerPass(currentReason, () =>
          runHistorySync(database, telegram, events, {
            ...options,
            discoverChats: currentReason === 'startup'
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          {
            event: 'history-sync.failed_pass',
            ...logError(error)
          },
          'history sync pass failed'
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

function timeControllerPass(reason: string, operation: () => Promise<void>): Promise<void> {
  const attributes = {
    'history_sync.controller.reason': reasonCategory(reason)
  };
  return timeTelemetrySpan(
    {
      attributes,
      metric: {
        attributes,
        name: METRIC_CONTROLLER_PASS_DURATION
      },
      name: 'history_sync.controller.pass'
    },
    operation
  );
}

function reasonCategory(reason: string): TelemetryAttributes[string] {
  if (reason.startsWith('manual:')) {
    return 'manual';
  }
  return reason;
}
