import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';

import { createInternalTrpcHttpServer } from '@agentg/rpc/http-server';

import { formatInternalTrpcBindAddress, type InternalTrpcBindConfig } from './config.js';
import { createTelegramRouter } from './router.js';
import { createTelegramRpcContext } from './trpc.js';
import type { TelegramRpcRuntime } from './runtime.js';

export const TELEGRAM_CONTROL_PLANE_ASSETS_ROOT = fileURLToPath(
  new URL('../../dist-control-plane/', import.meta.url)
);

export async function startTelegramTrpcServer(
  options: TelegramRpcRuntime & {
    bind: InternalTrpcBindConfig;
    filesDirectory: string;
  }
): Promise<Server> {
  const server = createInternalTrpcHttpServer({
    createContext: (contextOptions) =>
      createTelegramRpcContext(contextOptions, {
        eventBus: options.eventBus
      }),
    router: createTelegramRouter({
      client: options.client,
      database: options.database,
      eventBus: options.eventBus
    }),
    staticAssets: [
      {
        rootDir: TELEGRAM_CONTROL_PLANE_ASSETS_ROOT,
        urlPrefix: '/control-plane-assets/'
      },
      {
        rootDir: options.filesDirectory,
        urlPrefix: '/telegram-files/'
      }
    ]
  });
  const address = formatInternalTrpcBindAddress(options.bind);

  await listen(server, options.bind.host, options.bind.port);

  console.log(JSON.stringify({ address, event: 'telegram.trpc.ready' }));
  return server;
}

export function stopTelegramTrpcServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve) => {
    server.listen(port, host, resolve);
  });
}
