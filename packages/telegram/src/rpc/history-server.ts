import type { Server } from 'node:http';

import type { TelegramDatabase as AppDatabase } from '../database.js';
import type { EventBus } from '@agentg/shared/events/bus';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

import { createTelegramHistoryRouter } from './history-router.js';
import { formatInternalTrpcBindAddress, type InternalTrpcBindConfig } from './config.js';
import { createTelegramRpcContext } from './trpc.js';

type TelegramClient = {
  invoke(request: Record<string, unknown>): Promise<unknown>;
};

export async function startTelegramHistoryTrpcServer(options: {
  bind: InternalTrpcBindConfig;
  client: TelegramClient;
  database: AppDatabase;
  eventBus: EventBus;
}): Promise<Server> {
  const server = createHTTPServer({
    createContext: (contextOptions) =>
      createTelegramRpcContext(contextOptions, {
        eventBus: options.eventBus
      }),
    router: createTelegramHistoryRouter({
      client: options.client,
      database: options.database,
      eventBus: options.eventBus
    })
  });
  const address = formatInternalTrpcBindAddress(options.bind);

  await listen(server, options.bind.host, options.bind.port);

  console.log(JSON.stringify({ address, event: 'telegram.history_trpc.ready' }));
  return server;
}

export function stopTelegramHistoryTrpcServer(server: Server): Promise<void> {
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
