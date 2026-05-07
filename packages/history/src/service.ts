import type { HistoryDatabase as AppDatabase } from './database.js';
import { createServiceDirectoryClient } from '@agentg/service-directory/rpc';
import type { EventBus, EventSubscription } from '@agentg/events/bus';
import { createIntegrationEvent } from '@agentg/events/envelope';

import {
  createHistorySyncController,
  type BackfillOptions,
  type HistorySyncController
} from './controller.js';
import { createLiveCoverageObserver, type LiveCoverageObserver } from './live-coverage.js';
import type { InternalTrpcBindConfig } from './rpc/config.js';
import { startHistoryTrpcServer, stopHistoryTrpcServer } from './rpc/history-server.js';
import { createHistoryServiceManifest } from './registrations.js';
import { historyCoverageChangedData } from './events.js';
import { addHistoryCoverageBatch } from './store.js';
import { createServiceDirectoryTelegramHistoryClient } from './telegram-client.js';

export type HistoryServiceOptions = {
  backfill: BackfillOptions;
  database: AppDatabase;
  eventBus: EventBus;
  internalRpc: InternalTrpcBindConfig;
  serviceRpcUrl: string;
  services: {
    serviceDirectory: {
      url: string;
    };
  };
};

const HISTORY_STATUS_TICK_MS = 5000;
const HISTORY_SHUTDOWN_FORCE_EXIT_MS = 4500;
const HISTORY_SHUTDOWN_STEP_TIMEOUT_MS = 2000;

export async function runHistoryService(options: HistoryServiceOptions): Promise<void> {
  let shuttingDown = false;
  let historyRpcServer: Awaited<ReturnType<typeof startHistoryTrpcServer>> | undefined;
  let liveCoverageTick: ReturnType<typeof setInterval> | undefined;
  const serviceDirectory = createServiceDirectoryClient({
    eventBus: options.eventBus,
    onTopologyFailure: (error) => {
      requestProcessShutdown('history.topology_failure', error);
    },
    url: options.services.serviceDirectory.url
  });
  const telegram = createServiceDirectoryTelegramHistoryClient(serviceDirectory);
  const controller = createHistorySyncController(
    options.database,
    telegram,
    options.backfill,
    options.eventBus,
    () => shuttingDown
  );
  const liveCoverageObserver = createLiveCoverageObserver({
    addCoverageBatch: (intervals) => addHistoryCoverageBatch(options.database, intervals),
    listChatIds: async () => (await telegram.listChats({ discover: false })).map((chat) => chat.id),
    publishCoverageChanged: (intervals) => {
      options.eventBus.publish(
        createIntegrationEvent({
          data: historyCoverageChangedData(intervals),
          source: 'history.live',
          type: 'history.coverage.changed'
        })
      );
    }
  });
  let subscriptions: EventSubscription[] = [];
  try {
    await serviceDirectory.refresh();
    subscriptions = subscribeHistoryService({
      controller,
      eventBus: options.eventBus,
      liveCoverageObserver
    });
    liveCoverageTick = setInterval(() => {
      void liveCoverageObserver.tick();
    }, HISTORY_STATUS_TICK_MS);
    historyRpcServer = await startHistoryTrpcServer({
      bind: options.internalRpc,
      database: options.database,
      eventBus: options.eventBus,
      requestSync(reason) {
        controller.request(reason);
      },
      telegram
    });
    await serviceDirectory.join(createHistoryServiceManifest({ rpcUrl: options.serviceRpcUrl }));
  } catch (error) {
    shuttingDown = true;
    await cleanupHistoryStartupFailure({
      controller,
      eventBus: options.eventBus,
      historyRpcServer,
      liveCoverageObserver,
      liveCoverageTick,
      serviceDirectory,
      subscriptions,
      telegram
    });
    throw error;
  }
  controller.request('startup');

  console.log(JSON.stringify({ event: 'history.ready' }));
  await waitForShutdown(async () => {
    shuttingDown = true;
    if (liveCoverageTick !== undefined) {
      clearInterval(liveCoverageTick);
      liveCoverageTick = undefined;
    }
    await liveCoverageObserver.markDisconnected();
    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }
    const activeHistoryRpcServer = historyRpcServer;
    const historyRpcStopped =
      activeHistoryRpcServer === undefined
        ? true
        : await runShutdownStep('history.rpc_close', () =>
            stopHistoryTrpcServer(activeHistoryRpcServer)
          );
    if (historyRpcStopped) {
      historyRpcServer = undefined;
    }
    serviceDirectory.close();
    telegram.close?.();
    controller.stop();
    const [historyStopped, liveCoverageStopped] = await Promise.all([
      runShutdownStep('history.controller_wait', () => controller.wait()),
      runShutdownStep('history.live_coverage_wait', () => liveCoverageObserver.wait())
    ]);
    const eventBusClosed = await runShutdownStep('history.event_bus_close', () =>
      options.eventBus.close()
    );

    return historyRpcStopped && historyStopped && liveCoverageStopped && eventBusClosed;
  });
}

async function cleanupHistoryStartupFailure(options: {
  controller: HistorySyncController;
  eventBus: EventBus;
  historyRpcServer: Awaited<ReturnType<typeof startHistoryTrpcServer>> | undefined;
  liveCoverageObserver: LiveCoverageObserver;
  liveCoverageTick: ReturnType<typeof setInterval> | undefined;
  serviceDirectory: ReturnType<typeof createServiceDirectoryClient>;
  subscriptions: EventSubscription[];
  telegram: ReturnType<typeof createServiceDirectoryTelegramHistoryClient>;
}): Promise<void> {
  if (options.liveCoverageTick !== undefined) {
    clearInterval(options.liveCoverageTick);
  }

  await runShutdownStep('history.live_coverage_startup_disconnect', () =>
    options.liveCoverageObserver.markDisconnected()
  );

  for (const subscription of options.subscriptions) {
    try {
      subscription.unsubscribe();
    } catch (error) {
      console.warn(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          event: 'history.startup_cleanup_failed',
          step: 'history.subscription_unsubscribe'
        })
      );
    }
  }

  const historyRpcServer = options.historyRpcServer;
  if (historyRpcServer !== undefined) {
    await runShutdownStep('history.rpc_startup_close', () =>
      stopHistoryTrpcServer(historyRpcServer)
    );
  }

  await runShutdownStep('history.service_directory_startup_close', () =>
    Promise.resolve(options.serviceDirectory.close())
  );
  await runShutdownStep('history.telegram_startup_close', () =>
    Promise.resolve(options.telegram.close?.())
  );
  await runShutdownStep('history.controller_startup_stop', () =>
    Promise.resolve(options.controller.stop())
  );
  await Promise.all([
    runShutdownStep('history.controller_startup_wait', () => options.controller.wait()),
    runShutdownStep('history.live_coverage_startup_wait', () =>
      options.liveCoverageObserver.wait()
    ),
    runShutdownStep('history.event_bus_startup_close', () => options.eventBus.close())
  ]);
}

function requestProcessShutdown(event: string, error: Error): void {
  console.error(
    JSON.stringify({
      error: error.message,
      event
    })
  );
  process.exitCode = 1;
  process.kill(process.pid, 'SIGTERM');
}

function subscribeHistoryService(options: {
  controller: HistorySyncController;
  eventBus: EventBus;
  liveCoverageObserver: LiveCoverageObserver;
}): EventSubscription[] {
  return [
    options.eventBus.subscribe('telegram.chat.updated', () => {
      options.controller.request('chat-updated');
    }),
    options.eventBus.subscribe('telegram.message.created', (event) => {
      const message = asRecord(asRecord(event.data)?.message);
      const chat = asRecord(message?.chat);
      const chatId =
        chat?._model === 'telegram.chat' && typeof chat.id === 'string' ? chat.id : undefined;
      const messageDate =
        typeof message?.messageDate === 'string' ? new Date(message.messageDate) : undefined;
      if (
        chatId !== undefined &&
        messageDate !== undefined &&
        !Number.isNaN(messageDate.getTime())
      ) {
        void options.liveCoverageObserver.recordLiveMessage(chatId, messageDate);
      }
    }),
    options.eventBus.subscribe('telegram.status', (event) => {
      const data = asRecord(event.data);
      if (data?.connected === true) {
        void options.liveCoverageObserver.markConnected();
        return;
      }
      void options.liveCoverageObserver.markDisconnected();
    })
  ];
}

async function runShutdownStep(name: string, step: () => Promise<void>): Promise<boolean> {
  try {
    await withTimeout(step(), HISTORY_SHUTDOWN_STEP_TIMEOUT_MS, name);
    return true;
  } catch (error) {
    console.warn(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: 'history.shutdown_step_failed',
        step: name
      })
    );
    return false;
  }
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number, name: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${name} timed out after ${String(milliseconds)}ms`));
        }, milliseconds);
        timeout.unref();
      })
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

async function waitForShutdown(close: () => Promise<boolean>): Promise<void> {
  await new Promise<void>((resolve) => {
    let shutdownStarted = false;
    const shutdown = (signal: NodeJS.Signals): void => {
      if (shutdownStarted) {
        console.warn(
          JSON.stringify({
            event: 'history.shutdown_repeated_signal',
            signal
          })
        );
        return;
      }

      shutdownStarted = true;
      console.log(
        JSON.stringify({
          event: 'history.shutdown_started',
          signal
        })
      );

      const forceExit = setTimeout(() => {
        console.error(
          JSON.stringify({
            event: 'history.shutdown_forced_exit',
            timeoutMs: HISTORY_SHUTDOWN_FORCE_EXIT_MS
          })
        );
        process.exit(130);
      }, HISTORY_SHUTDOWN_FORCE_EXIT_MS);
      forceExit.unref();

      void close()
        .then((clean) => {
          clearTimeout(forceExit);
          if (!clean) {
            console.warn(JSON.stringify({ event: 'history.shutdown_incomplete' }));
            process.exit(130);
            return;
          }
          resolve();
        })
        .catch((error: unknown) => {
          clearTimeout(forceExit);
          console.error(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              event: 'history.shutdown_failed'
            })
          );
          process.exit(130);
        });
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
