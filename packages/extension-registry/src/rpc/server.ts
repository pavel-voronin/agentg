import type { Server } from 'node:http';

import { createHTTPServer } from '@trpc/server/adapters/standalone';

import type { ExtensionRegistryBindConfig } from '../config.js';
import { createExtensionRegistry, type ExtensionRegistry } from '../registry.js';
import { createExtensionRegistryRouter } from './router.js';

export async function startExtensionRegistryTrpcServer(options: {
  bind: ExtensionRegistryBindConfig;
  registry?: ExtensionRegistry;
  ttlMs?: number;
}): Promise<Server> {
  const registry =
    options.registry ??
    createExtensionRegistry(options.ttlMs === undefined ? {} : { ttlMs: options.ttlMs });
  const server = createHTTPServer({
    createContext: () => ({}),
    router: createExtensionRegistryRouter(registry)
  });

  const port = await listen(server, options.bind.host, options.bind.port);
  console.log(
    JSON.stringify({
      address: `${options.bind.host}:${String(port)}`,
      event: 'extension_registry.trpc.ready'
    })
  );

  return server;
}

export function stopExtensionRegistryTrpcServer(server: Server): Promise<void> {
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
