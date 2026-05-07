import type { Server } from 'node:http';

import { createHTTPServer } from '@trpc/server/adapters/standalone';

import { formatInternalTrpcBindAddress, type InternalTrpcBindConfig } from './config.js';
import { createTelegramRouter } from './router.js';
import { createTelegramRpcContext } from './trpc.js';
import type { TelegramRpcRuntime } from './runtime.js';

export async function startTelegramTrpcServer(
  options: TelegramRpcRuntime & {
    bind: InternalTrpcBindConfig;
  }
): Promise<Server> {
  const server = createHTTPServer({
    createContext: (contextOptions) =>
      createTelegramRpcContext(contextOptions, {
        eventBus: options.eventBus
      }),
    router: createTelegramRouter({
      client: options.client,
      database: options.database,
      eventBus: options.eventBus
    })
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
