import type { HistoryDatabase as AppDatabase } from './database.js';
import {
  readControlPlaneAssetVersions,
  watchControlPlaneAssetVersion,
  type ControlPlaneAssetVersionSubscription
} from '@agentg/infra/control-plane/assets';
import { createServiceDirectoryClient } from '@agentg/service-directory/rpc';
import type { EventBus, EventSubscription } from '@agentg/events/bus';
import { createValidatedEventBus } from '@agentg/events/validated-bus';
import { serviceManifestEventTypes } from '@agentg/rpc/call-event-types';

import {
  createHistorySyncController,
  type HistorySyncControllerOptions,
  type HistorySyncController
} from './controller.js';
import type { InternalTrpcBindConfig } from './rpc/config.js';
import {
  HISTORY_CONTROL_PLANE_ASSETS_ROOT,
  startHistoryTrpcServer,
  stopHistoryTrpcServer
} from './rpc/history-server.js';
import { createHistoryServiceManifest } from './registrations.js';
import { createServiceDirectoryTelegramHistoryClient } from './telegram-client.js';

export type HistoryServiceOptions = {
  database: AppDatabase;
  eventBus: EventBus;
  internalRpc: InternalTrpcBindConfig;
  serviceRpcUrl: string;
  services: {
    serviceDirectory: {
      url: string;
    };
  };
  sync: HistorySyncControllerOptions;
};

const HISTORY_SHUTDOWN_FORCE_EXIT_MS = 4500;
const HISTORY_SHUTDOWN_STEP_TIMEOUT_MS = 2000;

export async function runHistoryService(options: HistoryServiceOptions): Promise<void> {
  let shuttingDown = false;
  let historyRpcServer: Awaited<ReturnType<typeof startHistoryTrpcServer>> | undefined;
  let controlPlaneAssets: ControlPlaneAssetVersionSubscription | undefined;
  const initialControlPlaneAssets = await readControlPlaneAssetVersions(
    HISTORY_CONTROL_PLANE_ASSETS_ROOT
  );
  const serviceManifest = createHistoryServiceManifest({
    controlPlaneAssetVersion: initialControlPlaneAssets.version,
    controlPlaneAssetVersions: initialControlPlaneAssets.assets,
    rpcUrl: options.serviceRpcUrl
  });
  const eventBus = createValidatedEventBus(options.eventBus, {
    allowedTypes: serviceManifestEventTypes(serviceManifest),
    publisher: 'history'
  });
  const serviceDirectory = createServiceDirectoryClient({
    eventBus,
    onTopologyFailure: (error) => {
      requestProcessShutdown('history.topology_failure', error);
    },
    url: options.services.serviceDirectory.url
  });
  const telegram = createServiceDirectoryTelegramHistoryClient(serviceDirectory);
  const controller = createHistorySyncController(
    options.database,
    telegram,
    options.sync,
    eventBus,
    () => shuttingDown
  );
  let subscriptions: EventSubscription[] = [];
  try {
    await serviceDirectory.refresh();
    subscriptions = subscribeHistoryService({
      controller,
      eventBus
    });
    historyRpcServer = await startHistoryTrpcServer({
      bind: options.internalRpc,
      database: options.database,
      eventBus,
      requestSync(reason) {
        controller.request(reason);
      },
      telegram
    });
    await serviceDirectory.join(serviceManifest);
    controlPlaneAssets = watchControlPlaneAssetVersion({
      initialVersion: initialControlPlaneAssets,
      onError: (error) => {
        requestProcessShutdown('history.control_plane_assets_registration_failed', error);
      },
      onVersion: async (nextControlPlaneAssets) => {
        await serviceDirectory.join(
          createHistoryServiceManifest({
            controlPlaneAssetVersion: nextControlPlaneAssets.version,
            controlPlaneAssetVersions: nextControlPlaneAssets.assets,
            rpcUrl: options.serviceRpcUrl
          })
        );
        console.log(
          JSON.stringify({
            event: 'history.control_plane_assets_registered',
            version: nextControlPlaneAssets.version
          })
        );
      },
      rootDir: HISTORY_CONTROL_PLANE_ASSETS_ROOT
    });
  } catch (error) {
    shuttingDown = true;
    await cleanupHistoryStartupFailure({
      controlPlaneAssets,
      controller,
      eventBus,
      historyRpcServer,
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
    controlPlaneAssets?.close();
    controlPlaneAssets = undefined;
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
    const historyStopped = await runShutdownStep('history.controller_wait', () =>
      controller.wait()
    );
    const eventBusClosed = await runShutdownStep('history.event_bus_close', () => eventBus.close());

    return historyRpcStopped && historyStopped && eventBusClosed;
  });
}

async function cleanupHistoryStartupFailure(options: {
  controlPlaneAssets: ControlPlaneAssetVersionSubscription | undefined;
  controller: HistorySyncController;
  eventBus: EventBus;
  historyRpcServer: Awaited<ReturnType<typeof startHistoryTrpcServer>> | undefined;
  serviceDirectory: ReturnType<typeof createServiceDirectoryClient>;
  subscriptions: EventSubscription[];
  telegram: ReturnType<typeof createServiceDirectoryTelegramHistoryClient>;
}): Promise<void> {
  options.controlPlaneAssets?.close();
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
}): EventSubscription[] {
  return [
    options.eventBus.subscribe('telegram.chat.updated', () => {
      options.controller.request('chat-updated');
    }),
    options.eventBus.subscribe('telegram.chat.removed', () => {
      options.controller.request('chat-removed');
    }),
    options.eventBus.subscribe('telegram.history.coverage.changed', () => {
      options.controller.request('coverage-changed');
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
