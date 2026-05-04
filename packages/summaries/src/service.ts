import type { Server } from 'node:http';

import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import { startRegistrationRefresh } from '@agentg/shared/modules/runtime';

import type { SummariesServiceConfig } from './config.js';
import type { SummariesDatabase } from './database.js';
import { registerSummariesCapabilities, registerSummariesExtensions } from './registrations.js';
import { startSummariesTrpcServer, stopSummariesTrpcServer } from './rpc/server.js';
import { handleSummariesEvent, type SummariesRuntime } from './summary-service.js';
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
  const subscriptions = subscribeSummariesService(runtime, options.eventBus);
  const refresh = startRegistrationRefresh({
    intervalMs: options.config.registrationRefreshMs,
    onError(error) {
      console.error(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          event: 'summaries.registration_refresh_failed'
        })
      );
    },
    refresh: async () => {
      await registerSummariesCapabilities(
        options.config.module,
        options.config.services.gateway.url
      );
      await registerSummariesExtensions(
        options.config.module,
        options.config.services.extensionRegistry.url
      );
    }
  });

  summariesRpcServer = await startSummariesTrpcServer({
    bind: options.config.internalRpc,
    eventBus: options.eventBus,
    runtime
  });
  await refresh.refresh();

  console.log(JSON.stringify({ event: 'summaries.ready' }));
  await waitForShutdown(async () => {
    refresh.stop();
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
