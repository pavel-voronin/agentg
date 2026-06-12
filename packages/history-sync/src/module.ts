import { createLogger, defineModule, logError, type EventEnvelope } from '@agentg/framework';
import { telegramClient } from '@agentg/telegram';

import { readConfig } from './config.js';
import { createDatabase } from './database/client.js';
import { createProcedures } from './procedures/index.js';
import { createController } from './sync/controller.js';
import { createTargetState } from './target/targetState.js';
import { listHistorySyncTargets } from './target/store.js';

const logger = createLogger('history-sync');

export const historySyncModule = defineModule('history-sync', {
  config: readConfig,
  setup({ background, config, events, resource, startup }) {
    const database = resource('database', ({ startup }) => {
      const databaseResource = createDatabase(config.databaseUrl);

      startup(() => databaseResource.start());

      return databaseResource.db;
    });
    const telegram = telegramClient({ url: config.telegramRpcUrl });
    const targets = createTargetState();
    startup('target-state', async () => {
      targets.replace(await listHistorySyncTargets(database));
    });
    const controller = createController(
      database,
      telegram,
      events,
      {
        chatLoadBatchSize: config.chatLoadBatchSize,
        messageLimit: config.messageLimit,
        requestDelayMs: config.requestDelayMs,
        windowDays: config.windowDays
      },
      {
        targetsChanged(nextTargets) {
          targets.replace(nextTargets);
        }
      }
    );

    background('sync', () => {
      const subscriptions = [
        events.subscribe('telegram.update.chat.discovered', (event) => {
          const chatId = discoveredChatId(event);
          if (chatId !== undefined) {
            controller.request(`chat-discovered:${chatId}`);
          }
        })
      ];
      const scheduler = startRelativeTargetScheduler({
        controller,
        intervalMs: config.reconcileIntervalMs,
        targets
      });

      controller.request('startup');
      return async () => {
        for (const subscription of subscriptions) {
          subscription.unsubscribe();
        }
        scheduler.stop();
        controller.stop();
        await controller.wait();
      };
    });

    return createProcedures({
      controller,
      database,
      events,
      targets,
      telegram
    });
  }
});

function startRelativeTargetScheduler(options: {
  controller: ReturnType<typeof createController>;
  intervalMs: number;
  targets: ReturnType<typeof createTargetState>;
}): { stop(): void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (): void => {
    if (stopped) {
      return;
    }
    timer = setTimeout(
      () => {
        timer = undefined;
        tick();
      },
      Math.max(1, options.intervalMs)
    );
    timer.unref();
  };

  const tick = (): void => {
    try {
      if (options.targets.hasRelativeTargets()) {
        options.controller.request('relative-targets');
      }
    } catch (error) {
      logger.error(
        {
          event: 'history-sync.relative_scheduler_failed',
          ...logError(error)
        },
        'history sync relative target scheduler failed'
      );
    } finally {
      schedule();
    }
  };

  schedule();
  return {
    stop() {
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    }
  };
}

function discoveredChatId(event: EventEnvelope): string | undefined {
  const data = event.data;
  if (typeof data !== 'object' || data === null || !('args' in data)) {
    return undefined;
  }
  const args = (data as { args?: unknown }).args;
  if (!Array.isArray(args)) {
    return undefined;
  }
  const chatId: unknown = args[0];
  return typeof chatId === 'string' && chatId.length > 0 ? chatId : undefined;
}
