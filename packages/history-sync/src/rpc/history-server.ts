import type { Server } from 'node:http';

import type { AppDatabase } from '@agentg/database/client';
import type { EventBus } from '@agentg/shared/events/bus';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

import { formatInternalTrpcBindAddress, type InternalTrpcBindConfig } from './config.js';
import { createHistoryRouter } from './history-router.js';
import { createHistoryRpcContext } from './trpc.js';
import type { TelegramReadClient } from '../telegram-client.js';

export async function startHistoryTrpcServer(options: {
  bind: InternalTrpcBindConfig;
  database: AppDatabase;
  eventBus: EventBus;
  requestSync?: (reason: string, chatId?: string) => void;
  telegram: TelegramReadClient;
}): Promise<Server> {
  const server = createHTTPServer({
    createContext: createHistoryRpcContext,
    router: createHistoryRouter({
      database: options.database,
      eventBus: options.eventBus,
      ...(options.requestSync === undefined ? {} : { requestSync: options.requestSync }),
      telegram: options.telegram
    })
  });
  const address = formatInternalTrpcBindAddress(options.bind);

  await listen(server, options.bind.host, options.bind.port);

  console.log(JSON.stringify({ address, event: 'history.trpc.ready' }));
  return server;
}

export function stopHistoryTrpcServer(server: Server): Promise<void> {
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
