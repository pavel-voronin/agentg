import type { Server } from 'node:http';

import type { HistoryDatabase as AppDatabase } from '../database.js';
import type { EventBus } from '@agentg/shared/events/bus';
import {
  createExtensionRegistry,
  type ExtensionCallerResolver,
  type ExtensionRegistry
} from '@agentg/shared/rpc/extensions';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

import { formatInternalTrpcBindAddress, type InternalTrpcBindConfig } from './config.js';
import { createHistoryRouter } from './history-router.js';
import { createHistoryRpcContext } from './trpc.js';
import type { TelegramReadClient } from '../telegram-client.js';

export async function startHistoryTrpcServer(options: {
  bind: InternalTrpcBindConfig;
  database: AppDatabase;
  eventBus: EventBus;
  extensionCallTimeoutMs?: number;
  extensionRegistry?: ExtensionRegistry;
  resolveExtensionCaller?: ExtensionCallerResolver;
  requestSync?: (reason: string, chatId?: string) => void;
  telegram: TelegramReadClient;
}): Promise<Server> {
  const extensionRegistry = options.extensionRegistry ?? createExtensionRegistry();
  const server = createHTTPServer({
    createContext: (contextOptions) =>
      createHistoryRpcContext(contextOptions, {
        eventBus: options.eventBus,
        ...(options.extensionCallTimeoutMs === undefined
          ? {}
          : { extensionCallTimeoutMs: options.extensionCallTimeoutMs }),
        extensionRegistry,
        ...(options.resolveExtensionCaller === undefined
          ? {}
          : { resolveExtensionCaller: options.resolveExtensionCaller })
      }),
    router: createHistoryRouter({
      database: options.database,
      eventBus: options.eventBus,
      extensionRegistry,
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
