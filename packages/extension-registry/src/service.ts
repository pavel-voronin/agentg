import type { Server } from 'node:http';

import type { ExtensionRegistryServiceConfig } from './config.js';
import { startExtensionRegistryTrpcServer, stopExtensionRegistryTrpcServer } from './rpc/server.js';

const EXTENSION_REGISTRY_SHUTDOWN_FORCE_EXIT_MS = 4500;
const EXTENSION_REGISTRY_SHUTDOWN_STEP_TIMEOUT_MS = 2000;

export async function runExtensionRegistryService(
  config: ExtensionRegistryServiceConfig
): Promise<void> {
  let rpcServer: Server | undefined;

  rpcServer = await startExtensionRegistryTrpcServer({
    bind: config.internalRpc,
    ttlMs: config.registrationTtlMs
  });

  console.log(JSON.stringify({ event: 'extension_registry.ready' }));
  await waitForShutdown(async () => {
    const activeRpcServer = rpcServer;
    const stopped =
      activeRpcServer === undefined
        ? true
        : await runShutdownStep('extension_registry.rpc_close', () =>
            stopExtensionRegistryTrpcServer(activeRpcServer)
          );

    if (stopped) {
      rpcServer = undefined;
    }

    return stopped;
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
      }, EXTENSION_REGISTRY_SHUTDOWN_FORCE_EXIT_MS);
      forceExit.unref();

      void shutdown().finally(finish);
    };

    process.once('SIGINT', handleSignal);
    process.once('SIGTERM', handleSignal);
  });
}

async function runShutdownStep(name: string, step: () => Promise<void>): Promise<boolean> {
  try {
    await withTimeout(step(), EXTENSION_REGISTRY_SHUTDOWN_STEP_TIMEOUT_MS, name);
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
