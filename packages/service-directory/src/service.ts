import type { Server } from 'node:http';

import type { EventBus } from '@agentg/shared/events/bus';

import type { ServiceDirectoryServiceConfig } from './config.js';
import { startServiceDirectoryTrpcServer, stopServiceDirectoryTrpcServer } from './rpc/server.js';

const SERVICE_DIRECTORY_SHUTDOWN_FORCE_EXIT_MS = 4500;
const SERVICE_DIRECTORY_SHUTDOWN_STEP_TIMEOUT_MS = 2000;

export async function runServiceDirectoryService(options: {
  config: ServiceDirectoryServiceConfig;
  eventBus: EventBus;
}): Promise<void> {
  let rpcServer: Server | undefined;

  rpcServer = await startServiceDirectoryTrpcServer({
    bind: options.config.internalRpc,
    eventBus: options.eventBus,
    ttlMs: options.config.leaseTtlMs
  });

  console.log(JSON.stringify({ event: 'service_directory.ready' }));
  await waitForShutdown(async () => {
    const activeRpcServer = rpcServer;
    const stopped =
      activeRpcServer === undefined
        ? true
        : await runShutdownStep('service_directory.rpc_close', () =>
            stopServiceDirectoryTrpcServer(activeRpcServer)
          );

    if (stopped) {
      rpcServer = undefined;
    }

    const eventBusClosed = await runShutdownStep('service_directory.event_bus_close', () =>
      options.eventBus.close()
    );

    return stopped && eventBusClosed;
  });
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
      }, SERVICE_DIRECTORY_SHUTDOWN_FORCE_EXIT_MS);
      forceExit.unref();

      void shutdown().finally(finish);
    };

    process.once('SIGINT', handleSignal);
    process.once('SIGTERM', handleSignal);
  });
}

async function runShutdownStep(name: string, step: () => Promise<void>): Promise<boolean> {
  try {
    await withTimeout(step(), SERVICE_DIRECTORY_SHUTDOWN_STEP_TIMEOUT_MS, name);
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
