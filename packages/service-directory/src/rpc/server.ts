import type { Server } from 'node:http';

import type { EventBus } from '@agentg/shared/events/bus';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

import type { ServiceDirectoryBindConfig } from '../config.js';
import { createServiceDirectory, type ServiceDirectory } from '../registry.js';
import {
  createServiceDirectoryRouter,
  publishServiceDirectoryChanged
} from './router.js';

export async function startServiceDirectoryTrpcServer(options: {
  bind: ServiceDirectoryBindConfig;
  directory?: ServiceDirectory;
  eventBus?: EventBus;
  ttlMs?: number;
}): Promise<Server> {
  const ttlMs = options.ttlMs;
  const directory =
    options.directory ??
    createServiceDirectory(ttlMs === undefined ? {} : { ttlMs });
  const server = createHTTPServer({
    createContext: () => ({}),
    router: createServiceDirectoryRouter(directory, options.eventBus)
  });
  const sweep = startLeaseSweep(directory, options.eventBus, ttlMs);
  server.once('close', () => {
    clearInterval(sweep);
  });

  const port = await listen(server, options.bind.host, options.bind.port);
  console.log(
    JSON.stringify({
      address: `${options.bind.host}:${String(port)}`,
      event: 'service_directory.trpc.ready'
    })
  );

  return server;
}

function startLeaseSweep(
  directory: ServiceDirectory,
  eventBus: EventBus | undefined,
  ttlMs: number | undefined
): ReturnType<typeof setInterval> {
  const sweep = setInterval(() => {
    const result = directory.getSnapshot();
    publishServiceDirectoryChanged(eventBus, result.changed, result.output.version);
  }, sweepIntervalMs(ttlMs));
  sweep.unref();
  return sweep;
}

function sweepIntervalMs(ttlMs: number | undefined): number {
  if (ttlMs === undefined) {
    return 30_000;
  }

  return Math.max(10, Math.floor(ttlMs / 2));
}

export function stopServiceDirectoryTrpcServer(server: Server): Promise<void> {
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
