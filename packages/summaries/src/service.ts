import type { Server } from 'node:http';

import { createServiceDirectoryClient } from '@agentg/service-directory/rpc';
import type { EventBus, EventSubscription } from '@agentg/events/bus';

import type { SummariesServiceConfig } from './config.js';
import type { SummariesDatabase } from './database.js';
import { createSummariesServiceManifest } from './registrations.js';
import { startSummariesTrpcServer, stopSummariesTrpcServer } from './rpc/server.js';
import type { SummariesRuntime } from './runtime.js';
import { handleSummariesEvent } from './summary-service.js';
import { createDrizzleSummaryRepository } from './store.js';

const SUMMARIES_SHUTDOWN_FORCE_EXIT_MS = 4500;
const SUMMARIES_SHUTDOWN_STEP_TIMEOUT_MS = 2000;

export type SummariesServiceOptions = {
  config: SummariesServiceConfig;
  database: SummariesDatabase;
  eventBus: EventBus;
};

export async function runSummariesService(options: SummariesServiceOptions): Promise<void> {
  const runtime: SummariesRuntime = {
    eventBus: options.eventBus,
    repository: createDrizzleSummaryRepository(options.database)
  };
  let summariesRpcServer: Server | undefined;
  let serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined;
  let subscriptions: EventSubscription[] = [];

  try {
    subscriptions = subscribeSummariesService(runtime, options.eventBus);
    summariesRpcServer = await startSummariesTrpcServer({
      bind: options.config.internalRpc,
      eventBus: options.eventBus,
      runtime
    });
    serviceDirectory = createServiceDirectoryClient({
      eventBus: options.eventBus,
      onTopologyFailure: (error) => {
        requestProcessShutdown('summaries.topology_failure', error);
      },
      url: options.config.services.serviceDirectory.url
    });
    await serviceDirectory.join(createSummariesServiceManifest(options.config.module));
  } catch (error) {
    await cleanupSummariesStartupFailure({
      eventBus: options.eventBus,
      serviceDirectory,
      subscriptions,
      summariesRpcServer
    });
    throw error;
  }

  console.log(JSON.stringify({ event: 'summaries.ready' }));
  await waitForShutdown(async () => {
    serviceDirectory?.close();
    serviceDirectory = undefined;
    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }
    const activeSummariesRpcServer = summariesRpcServer;
    const summariesRpcStopped =
      activeSummariesRpcServer === undefined
        ? true
        : await runShutdownStep('summaries.rpc_close', () =>
            stopSummariesTrpcServer(activeSummariesRpcServer)
          );
    if (summariesRpcStopped) {
      summariesRpcServer = undefined;
    }
    const eventBusClosed = await runShutdownStep('summaries.event_bus_close', () =>
      options.eventBus.close()
    );

    return summariesRpcStopped && eventBusClosed;
  });
}

async function cleanupSummariesStartupFailure(resources: {
  eventBus: EventBus;
  serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined;
  subscriptions: EventSubscription[];
  summariesRpcServer: Server | undefined;
}): Promise<void> {
  await runShutdownStep('summaries.service_directory_startup_close', () =>
    Promise.resolve(resources.serviceDirectory?.close())
  );

  for (const subscription of resources.subscriptions) {
    try {
      subscription.unsubscribe();
    } catch (error) {
      console.warn(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          event: 'summaries.startup_cleanup_failed',
          step: 'summaries.subscription_unsubscribe'
        })
      );
    }
  }

  const summariesRpcServer = resources.summariesRpcServer;
  if (summariesRpcServer !== undefined) {
    await runShutdownStep('summaries.rpc_startup_close', () =>
      stopSummariesTrpcServer(summariesRpcServer)
    );
  }

  await runShutdownStep('summaries.event_bus_startup_close', () => resources.eventBus.close());
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

function subscribeSummariesService(
  runtime: SummariesRuntime,
  eventBus: EventBus
): EventSubscription[] {
  return [
    eventBus.subscribe('telegram.message.created', async (event) => {
      await handleSummariesEvent(runtime, event);
    }),
    eventBus.subscribe('telegram.message.updated', async (event) => {
      await handleSummariesEvent(runtime, event);
    }),
    eventBus.subscribe('telegram.message.deleted', async (event) => {
      await handleSummariesEvent(runtime, event);
    }),
    eventBus.subscribe('history.coverage.changed', async (event) => {
      await handleSummariesEvent(runtime, event);
    }),
    eventBus.subscribe('history.target.deleted', async (event) => {
      await handleSummariesEvent(runtime, event);
    }),
    eventBus.subscribe('history.target.upserted', async (event) => {
      await handleSummariesEvent(runtime, event);
    })
  ];
}

async function waitForShutdown(shutdown: () => Promise<boolean>): Promise<void> {
  await new Promise<void>((resolve) => {
    let forceExit: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      if (forceExit !== undefined) {
        clearTimeout(forceExit);
      }
      resolve();
    };
    const handleSignal = (): void => {
      forceExit = setTimeout(() => {
        process.exitCode = 1;
        finish();
      }, SUMMARIES_SHUTDOWN_FORCE_EXIT_MS);
      forceExit.unref();

      void shutdown().finally(finish);
    };

    process.once('SIGINT', handleSignal);
    process.once('SIGTERM', handleSignal);
  });
}

async function runShutdownStep(name: string, step: () => Promise<void>): Promise<boolean> {
  try {
    await Promise.race([step(), delay(SUMMARIES_SHUTDOWN_STEP_TIMEOUT_MS)]);
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: `${name}.failed`
      })
    );
    return false;
  }
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    timeout.unref();
  });
}
