import { fileURLToPath } from 'node:url';

import type { HistorySyncDatabase as AppDatabase } from './database.js';
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
import type { InternalTrpcBindConfig } from '@agentg/rpc/config';
import { historySyncRpc } from './rpc/setup.js';
import { createHistorySyncServiceManifest } from './registrations.js';
import { createServiceDirectoryTelegramHistoryClient } from './telegramClient.js';

export type HistorySyncServiceOptions = {
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

const HISTORY_SYNC_SHUTDOWN_FORCE_EXIT_MS = 4500;
const HISTORY_SYNC_SHUTDOWN_STEP_TIMEOUT_MS = 2000;
const HISTORY_SYNC_CONTROL_PLANE_ASSETS_ROOT = fileURLToPath(
  new URL('../dist-control-plane/', import.meta.url)
);

export async function runHistorySyncService(options: HistorySyncServiceOptions): Promise<void> {
  let shuttingDown = false;
  let historySyncRpcServer: Awaited<ReturnType<typeof historySyncRpc.startServer>> | undefined;
  let controlPlaneAssets: ControlPlaneAssetVersionSubscription | undefined;
  const initialControlPlaneAssets = await readControlPlaneAssetVersions(
    HISTORY_SYNC_CONTROL_PLANE_ASSETS_ROOT
  );
  const serviceManifest = createHistorySyncServiceManifest({
    controlPlaneAssetVersion: initialControlPlaneAssets.version,
    controlPlaneAssetVersions: initialControlPlaneAssets.assets,
    rpcUrl: options.serviceRpcUrl
  });
  const eventBus = createValidatedEventBus(options.eventBus, {
    allowedTypes: serviceManifestEventTypes(serviceManifest),
    publisher: 'history-sync'
  });
  const serviceDirectory = createServiceDirectoryClient({
    eventBus,
    onTopologyFailure: (error) => {
      requestProcessShutdown('history-sync.topology_failure', error);
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
    subscriptions = subscribeHistorySyncService({
      controller,
      eventBus
    });
    historySyncRpcServer = await historySyncRpc.startServer({
      bind: options.internalRpc,
      eventBus,
      deps: {
        database: options.database,
        eventBus,
        requestSync(reason) {
          controller.request(reason);
        },
        telegram
      },
      staticAssets: {
        rootDir: HISTORY_SYNC_CONTROL_PLANE_ASSETS_ROOT,
        urlPrefix: '/control-plane-assets/'
      }
    });
    await serviceDirectory.join(serviceManifest);
    controlPlaneAssets = watchControlPlaneAssetVersion({
      initialVersion: initialControlPlaneAssets,
      onError: (error) => {
        requestProcessShutdown('history-sync.control_plane_assets_registration_failed', error);
      },
      onVersion: async (nextControlPlaneAssets) => {
        await serviceDirectory.join(
          createHistorySyncServiceManifest({
            controlPlaneAssetVersion: nextControlPlaneAssets.version,
            controlPlaneAssetVersions: nextControlPlaneAssets.assets,
            rpcUrl: options.serviceRpcUrl
          })
        );
        console.log(
          JSON.stringify({
            event: 'history-sync.control_plane_assets_registered',
            version: nextControlPlaneAssets.version
          })
        );
      },
      rootDir: HISTORY_SYNC_CONTROL_PLANE_ASSETS_ROOT
    });
  } catch (error) {
    shuttingDown = true;
    await cleanupHistorySyncStartupFailure({
      controlPlaneAssets,
      controller,
      eventBus,
      historySyncRpcServer,
      serviceDirectory,
      subscriptions,
      telegram
    });
    throw error;
  }
  controller.request('startup');

  console.log(JSON.stringify({ event: 'history-sync.ready' }));
  await waitForShutdown(async () => {
    shuttingDown = true;
    controlPlaneAssets?.close();
    controlPlaneAssets = undefined;
    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }
    const activeHistorySyncRpcServer = historySyncRpcServer;
    const historySyncRpcStopped =
      activeHistorySyncRpcServer === undefined
        ? true
        : await runShutdownStep('history-sync.rpc_close', () =>
            historySyncRpc.stopServer(activeHistorySyncRpcServer)
          );
    if (historySyncRpcStopped) {
      historySyncRpcServer = undefined;
    }
    serviceDirectory.close();
    telegram.close?.();
    controller.stop();
    const historySyncStopped = await runShutdownStep('history-sync.controller_wait', () =>
      controller.wait()
    );
    const eventBusClosed = await runShutdownStep('history-sync.event_bus_close', () =>
      eventBus.close()
    );

    return historySyncRpcStopped && historySyncStopped && eventBusClosed;
  });
}

async function cleanupHistorySyncStartupFailure(options: {
  controlPlaneAssets: ControlPlaneAssetVersionSubscription | undefined;
  controller: HistorySyncController;
  eventBus: EventBus;
  historySyncRpcServer: Awaited<ReturnType<typeof historySyncRpc.startServer>> | undefined;
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
          event: 'history-sync.startup_cleanup_failed',
          step: 'history-sync.subscription_unsubscribe'
        })
      );
    }
  }

  const historySyncRpcServer = options.historySyncRpcServer;
  if (historySyncRpcServer !== undefined) {
    await runShutdownStep('history-sync.rpc_startup_close', () =>
      historySyncRpc.stopServer(historySyncRpcServer)
    );
  }

  await runShutdownStep('history-sync.service_directory_startup_close', () =>
    Promise.resolve(options.serviceDirectory.close())
  );
  await runShutdownStep('history-sync.telegram_startup_close', () =>
    Promise.resolve(options.telegram.close?.())
  );
  await runShutdownStep('history-sync.controller_startup_stop', () =>
    Promise.resolve(options.controller.stop())
  );
  await Promise.all([
    runShutdownStep('history-sync.controller_startup_wait', () => options.controller.wait()),
    runShutdownStep('history-sync.event_bus_startup_close', () => options.eventBus.close())
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

export function subscribeHistorySyncService(options: {
  controller: HistorySyncController;
  eventBus: EventBus;
}): EventSubscription[] {
  return [
    options.eventBus.subscribe('telegram.chat.updated', () => {
      options.controller.request('chat-updated');
    }),
    options.eventBus.subscribe('telegram.chat.removed', () => {
      options.controller.request('chat-removed');
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
        event: 'history-sync.shutdown_step_failed',
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
            event: 'history-sync.shutdown_repeated_signal',
            signal
          })
        );
        return;
      }

      shutdownStarted = true;
      console.log(
        JSON.stringify({
          event: 'history-sync.shutdown_started',
          signal
        })
      );

      const forceExit = setTimeout(() => {
        console.error(
          JSON.stringify({
            event: 'history-sync.shutdown_forced_exit',
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
            console.warn(JSON.stringify({ event: 'history-sync.shutdown_incomplete' }));
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
              event: 'history-sync.shutdown_failed'
            })
          );
          process.exit(130);
        });
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  });
}
