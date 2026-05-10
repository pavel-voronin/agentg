import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';

import type { HistorySyncDatabase as AppDatabase } from '../database.js';
import type { EventBus } from '@agentg/events/bus';
import { createInternalTrpcHttpServer } from '@agentg/rpc/http-server';

import { formatInternalTrpcBindAddress, type InternalTrpcBindConfig } from './config.js';
import { createHistorySyncRouter } from './router.js';
import { createHistorySyncRpcContext } from './trpc.js';
import type { TelegramReadClient } from '../telegram-client.js';

export const HISTORY_SYNC_CONTROL_PLANE_ASSETS_ROOT = fileURLToPath(
  new URL('../../dist-control-plane/', import.meta.url)
);

export async function startHistorySyncTrpcServer(options: {
  bind: InternalTrpcBindConfig;
  database: AppDatabase;
  eventBus: EventBus;
  requestSync?: (reason: string, chatId?: string) => void;
  telegram: TelegramReadClient;
}): Promise<Server> {
  const server = createInternalTrpcHttpServer({
    createContext: (contextOptions) =>
      createHistorySyncRpcContext(contextOptions, {
        eventBus: options.eventBus
      }),
    router: createHistorySyncRouter({
      database: options.database,
      eventBus: options.eventBus,
      ...(options.requestSync === undefined ? {} : { requestSync: options.requestSync }),
      telegram: options.telegram
    }),
    staticAssets: {
      rootDir: HISTORY_SYNC_CONTROL_PLANE_ASSETS_ROOT,
      urlPrefix: '/control-plane-assets/'
    }
  });
  const address = formatInternalTrpcBindAddress(options.bind);

  await listen(server, options.bind.host, options.bind.port);

  console.log(JSON.stringify({ address, event: 'history-sync.trpc.ready' }));
  return server;
}

export function stopHistorySyncTrpcServer(server: Server): Promise<void> {
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
