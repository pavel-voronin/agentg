import type { Server } from 'node:http';

import type { EventBus } from '@agentg/events/bus';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

import { createSummariesRouter } from './router.js';
import { createSummariesRpcContext } from './trpc.js';
import type { SummariesRuntime } from '../runtime.js';

export type SummariesRpcBindConfig = {
  host: string;
  port: number;
};

export async function startSummariesTrpcServer(options: {
  bind: SummariesRpcBindConfig;
  eventBus: EventBus;
  runtime: SummariesRuntime;
}): Promise<Server> {
  const server = createHTTPServer({
    createContext: (contextOptions) =>
      createSummariesRpcContext(contextOptions, {
        eventBus: options.eventBus
      }),
    router: createSummariesRouter(options.runtime)
  });

  const port = await listen(server, options.bind.host, options.bind.port);
  console.log(
    JSON.stringify({
      address: `${options.bind.host}:${String(port)}`,
      event: 'summaries.trpc.ready'
    })
  );

  return server;
}

export function stopSummariesTrpcServer(server: Server): Promise<void> {
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

function listen(server: Server, host: string, port: number): Promise<number> {
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        resolve(address.port);
        return;
      }

      resolve(port);
    });
  });
}
