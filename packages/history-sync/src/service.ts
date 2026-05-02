import type { HistoryDatabase as AppDatabase } from './database.js';
import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import { createIntegrationEvent } from '@agentg/shared/events/envelope';

import {
  createHistorySyncController,
  type BackfillOptions,
  type HistorySyncController
} from './controller.js';
import { createLiveCoverageObserver, type LiveCoverageObserver } from './live-coverage.js';
import type { InternalTrpcBindConfig, InternalTrpcClientConfig } from './rpc/config.js';
import { startHistoryTrpcServer, stopHistoryTrpcServer } from './rpc/history-server.js';
import { addHistoryCoverageBatch } from './store.js';
import { createTrpcTelegramHistoryClient } from './telegram-client.js';

export type HistorySyncServiceOptions = {
  backfill: BackfillOptions;
  database: AppDatabase;
  eventBus: EventBus;
  internalRpc: InternalTrpcBindConfig;
  services: {
    telegram: InternalTrpcClientConfig;
  };
};

const HISTORY_SYNC_STATUS_TICK_MS = 5000;
const HISTORY_SYNC_SHUTDOWN_FORCE_EXIT_MS = 4500;
const HISTORY_SYNC_SHUTDOWN_STEP_TIMEOUT_MS = 2000;

export async function runHistorySyncService(options: HistorySyncServiceOptions): Promise<void> {
  let shuttingDown = false;
  let historyRpcServer: Awaited<ReturnType<typeof startHistoryTrpcServer>> | undefined;
  let liveCoverageTick: ReturnType<typeof setInterval> | undefined;
  const telegram = createTrpcTelegramHistoryClient(options.services.telegram);
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
      const startAt = minDateFromList(intervals.map((interval) => interval.startAt));
      const endAt = maxDateFromList(intervals.map((interval) => interval.endAt));
      options.eventBus.publish(
        createIntegrationEvent({
          data: {
            chatCount: intervals.length,
            endAt: endAt.toISOString(),
            startAt: startAt.toISOString()
          },
          source: 'history-sync.live',
          type: 'history.coverage.changed'
        })
      );
    }
  });
  const subscriptions = subscribeHistorySyncService({
    controller,
    eventBus: options.eventBus,
    liveCoverageObserver
  });

  liveCoverageTick = setInterval(() => {
    void liveCoverageObserver.tick();
  }, HISTORY_SYNC_STATUS_TICK_MS);
  historyRpcServer = await startHistoryTrpcServer({
    bind: options.internalRpc,
    database: options.database,
    eventBus: options.eventBus,
    requestSync(reason) {
      controller.request(reason);
    },
    telegram
  });
  controller.request('startup');

  console.log(JSON.stringify({ event: 'history_sync.ready' }));
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
        : await runShutdownStep('history_sync.rpc_close', () =>
            stopHistoryTrpcServer(activeHistoryRpcServer)
          );
    if (historyRpcStopped) {
      historyRpcServer = undefined;
    }
    telegram.close?.();
    controller.stop();
    const [historySyncStopped, liveCoverageStopped] = await Promise.all([
      runShutdownStep('history_sync.controller_wait', () => controller.wait()),
      runShutdownStep('history_sync.live_coverage_wait', () => liveCoverageObserver.wait())
    ]);
    const eventBusClosed = await runShutdownStep('history_sync.event_bus_close', () =>
      options.eventBus.close()
    );

    return historyRpcStopped && historySyncStopped && liveCoverageStopped && eventBusClosed;
  });
}

function subscribeHistorySyncService(options: {
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
      const chatId = typeof message?.chatId === 'string' ? message.chatId : undefined;
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
    options.eventBus.subscribe('telegram.tdlib.status', (event) => {
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
    await withTimeout(step(), HISTORY_SYNC_SHUTDOWN_STEP_TIMEOUT_MS, name);
    return true;
  } catch (error) {
    console.warn(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: 'history_sync.shutdown_step_failed',
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
            event: 'history_sync.shutdown_repeated_signal',
            signal
          })
        );
        return;
      }

      shutdownStarted = true;
      console.log(
        JSON.stringify({
          event: 'history_sync.shutdown_started',
          signal
        })
      );

      const forceExit = setTimeout(() => {
        console.error(
          JSON.stringify({
            event: 'history_sync.shutdown_forced_exit',
            timeoutMs: HISTORY_SYNC_SHUTDOWN_FORCE_EXIT_MS
          })
        );
        process.exit(130);
      }, HISTORY_SYNC_SHUTDOWN_FORCE_EXIT_MS);
      forceExit.unref();

      void close()
        .then((clean) => {
          clearTimeout(forceExit);
          if (!clean) {
            console.warn(JSON.stringify({ event: 'history_sync.shutdown_incomplete' }));
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
              event: 'history_sync.shutdown_failed'
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

function minDate(first: Date, ...rest: Date[]): Date;
function minDate(...dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('minDate requires at least one date');
  }
  return rest.reduce((minimum, date) => (date < minimum ? date : minimum), first);
}

function minDateFromList(dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('minDateFromList requires at least one date');
  }
  return minDate(first, ...rest);
}

function maxDate(first: Date, ...rest: Date[]): Date;
function maxDate(...dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('maxDate requires at least one date');
  }
  return rest.reduce((maximum, date) => (date > maximum ? date : maximum), first);
}

function maxDateFromList(dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('maxDateFromList requires at least one date');
  }
  return maxDate(first, ...rest);
}
