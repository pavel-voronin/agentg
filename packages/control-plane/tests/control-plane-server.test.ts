import { createServer, type Server } from 'node:http';

import type { EventBus, EventSubscription } from '@agentg/events/bus';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/events/envelope';
import type { ServiceDirectoryClient } from '@agentg/service-directory/rpc';
import { WebSocket, type RawData } from 'ws';
import { describe, expect, it, vi } from 'vitest';

import {
  startControlPlaneServer,
  type ControlPlaneServerConfig
} from '../src/server/control-plane-server.js';

describe('Control Plane server boundary', () => {
  it('routes browser RPC through the procedure proxy and forwards events', async () => {
    const eventBus = createFakeEventBus();
    const procedureProxy = {
      call: vi.fn(() =>
        Promise.resolve({
          items: 3,
          records: 5
        })
      ),
      close: vi.fn()
    };

    const server = await startControlPlaneServer({
      config: testControlPlaneServerConfig(),
      eventBus,
      procedureProxy
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      socket.send(JSON.stringify({ id: 1, method: 'beta.getStatus', params: { limit: 10 } }));

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        id: 1,
        result: {
          items: 3,
          records: 5
        }
      });
      expect(procedureProxy.call).toHaveBeenCalledWith('beta.getStatus', { limit: 10 });

      const event = createIntegrationEvent({
        data: {
          recordId: 'record-a'
        },
        type: 'beta.coverage.changed'
      });
      await eventBus.emit(event);

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        event
      });

      const rpcEvent = createIntegrationEvent({
        data: {
          callId: 'call-a',
          target: 'beta.getStatus'
        },
        type: 'beta.rpc.getStatus.started'
      });
      await eventBus.emit(rpcEvent);

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        event: rpcEvent
      });

      const analysisEvent = createIntegrationEvent({
        data: {
          recordId: 'record-a',
          runId: 'run-a'
        },
        type: 'beta.analysis.requested'
      });
      await eventBus.emit(analysisEvent);

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        event: analysisEvent
      });
    } finally {
      socket.close();
      await server.close();
    }
  });

  it('returns proxy failures as RPC errors', async () => {
    const eventBus = createFakeEventBus();
    const procedureProxy = {
      call: vi.fn(() => Promise.reject(new Error('Procedure failed'))),
      close: vi.fn()
    };

    const server = await startControlPlaneServer({
      config: testControlPlaneServerConfig(),
      eventBus,
      procedureProxy
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      socket.send(JSON.stringify({ id: 2, method: 'alpha.fail', params: {} }));

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        id: 2,
        error: {
          code: 'method_failed',
          message: 'Procedure failed'
        }
      });
    } finally {
      socket.close();
      await server.close();
    }
  });

  it('serves browser runtime metadata endpoints without a service directory client', async () => {
    const eventBus = createFakeEventBus();
    const procedureProxy = {
      call: vi.fn(() => Promise.resolve(null)),
      close: vi.fn()
    };

    const server = await startControlPlaneServer({
      config: testControlPlaneServerConfig(),
      eventBus,
      procedureProxy
    });

    try {
      await expect(
        fetch(`http://127.0.0.1:${String(server.port)}/control-plane/content-catalog`).then(
          (response) => response.json()
        )
      ).resolves.toEqual({
        providers: [],
        version: 0
      });
      await expect(
        fetch(`http://127.0.0.1:${String(server.port)}/control-plane/event-catalog`).then(
          (response) => response.json()
        )
      ).resolves.toEqual({
        services: [],
        version: 0
      });
      const runtimeResponse = await fetch(
        `http://127.0.0.1:${String(server.port)}/control-plane/runtime/vue.js`
      );
      expect(runtimeResponse.status).toBe(200);
      await expect(runtimeResponse.text()).resolves.toContain('__VUE_HMR_RUNTIME__');
    } finally {
      await server.close();
    }
  });

  it('publishes versioned provider asset URLs and proxies only the active version', async () => {
    const eventBus = createFakeEventBus();
    const providerServer = await startProviderAssetServer({
      '/control-plane-assets/assets/style.css': '.alpha { color: red; }',
      '/control-plane-assets/chunks/shared.js': 'export const shared = true',
      '/control-plane-assets/tile.js': 'export default {}'
    });
    const serviceDirectory = createFakeServiceDirectory({
      extensions: [],
      services: [
        {
          controlPlane: {
            assetVersion: 'asset-v1',
            assetVersions: {
              'assets/style.css': 'style-v1',
              'chunks/shared.js': 'chunk-v1',
              'tile.js': 'tile-v1'
            },
            contents: [
              {
                contentId: 'alpha.tile',
                metadata: {
                  tab: {
                    label: 'Alpha',
                    order: 10
                  }
                },
                module: {
                  assetPath: 'tile.js'
                },
                styleAssetPaths: ['assets/style.css'],
                tags: ['dashboard.tile']
              }
            ]
          },
          events: [],
          expiresAt: '2026-05-04T00:01:00.000Z',
          extensions: [],
          procedures: [],
          registeredAt: '2026-05-04T00:00:00.000Z',
          required: false,
          rpcUrl: serverUrl(providerServer),
          slug: 'alpha'
        }
      ],
      version: 1
    });

    try {
      const controlPlane = await startControlPlaneServer({
        config: testControlPlaneServerConfig(),
        eventBus,
        procedureProxy: {
          call: vi.fn(() => Promise.resolve(null)),
          close: vi.fn()
        },
        serviceDirectory
      });

      try {
        const catalog = (await fetch(
          `http://127.0.0.1:${String(controlPlane.port)}/control-plane/content-catalog`
        ).then((response) => response.json())) as unknown;

        expect(catalog).toMatchObject({
          providers: [
            {
              assetVersion: 'asset-v1',
              contents: [
                {
                  contentId: 'alpha.tile',
                  metadata: {
                    tab: {
                      label: 'Alpha',
                      order: 10
                    }
                  },
                  module: {
                    url: '/control-plane/provider-assets/alpha/tile-v1/tile.js'
                  },
                  styleUrls: ['/control-plane/provider-assets/alpha/style-v1/assets/style.css'],
                  tags: ['dashboard.tile']
                }
              ],
              domainId: 'alpha'
            }
          ]
        });

        await expect(
          fetch(
            `http://127.0.0.1:${String(controlPlane.port)}/control-plane/provider-assets/alpha/tile-v1/tile.js`
          ).then((response) => response.text())
        ).resolves.toBe('export default {}');
        await expect(
          fetch(
            `http://127.0.0.1:${String(controlPlane.port)}/control-plane/provider-assets/alpha/tile-v1/chunks/shared.js`
          ).then((response) => response.text())
        ).resolves.toBe('export const shared = true');
        await expect(
          fetch(
            `http://127.0.0.1:${String(controlPlane.port)}/control-plane/provider-assets/alpha/old/tile.js`
          ).then((response) => response.status)
        ).resolves.toBe(404);
      } finally {
        await controlPlane.close();
      }
    } finally {
      serviceDirectory.close();
      await closeServer(providerServer);
    }
  });
});

type FakeEventBus = EventBus & {
  emit(event: IntegrationEvent): Promise<void>;
};
type ServiceDirectorySnapshot = ReturnType<ServiceDirectoryClient['getSnapshot']>;

function testControlPlaneServerConfig(
  overrides: Partial<ControlPlaneServerConfig> = {}
): ControlPlaneServerConfig {
  return {
    host: '127.0.0.1',
    port: 0,
    runtimeVueBuild: 'development',
    serviceUrl: 'http://127.0.0.1:0',
    staticDir: '/tmp/agentg-control-plane-test-missing',
    ...overrides
  };
}

function createFakeEventBus(): FakeEventBus {
  const subscriptions = new Map<
    number,
    {
      handler: (event: IntegrationEvent) => void | Promise<void>;
      subject: string;
    }
  >();
  let nextId = 1;

  return {
    close(): Promise<void> {
      return Promise.resolve();
    },
    async emit(event): Promise<void> {
      for (const subscription of subscriptions.values()) {
        if (matchesSubject(subscription.subject, event.type)) {
          await subscription.handler(event);
        }
      }
    },
    publish(): void {
      return;
    },
    subscribe(subject, handler): EventSubscription {
      const id = nextId;
      nextId += 1;
      subscriptions.set(id, {
        handler,
        subject
      });
      return {
        unsubscribe(): void {
          subscriptions.delete(id);
        }
      };
    }
  };
}

function matchesSubject(subject: string, type: string): boolean {
  if (subject.endsWith('>')) {
    return type.startsWith(subject.slice(0, -1));
  }

  return subject === type;
}

function openWebSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once('open', () => {
      resolve(socket);
    });
    socket.once('error', (error) => {
      reject(error);
    });
  });
}

function nextJsonMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    socket.once('message', (data) => {
      try {
        resolve(JSON.parse(rawDataToString(data)) as unknown);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    socket.once('error', (error) => {
      reject(error);
    });
  });
}

function rawDataToString(data: RawData): string {
  if (typeof data === 'string') {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return data.toString('utf8');
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8');
  }

  return Buffer.from(data).toString('utf8');
}

function createFakeServiceDirectory(snapshot: ServiceDirectorySnapshot): ServiceDirectoryClient {
  return {
    close(): void {
      return;
    },
    extensionsForTarget(target): ServiceDirectorySnapshot['extensions'] {
      return snapshot.extensions.filter((extension) => extension.target === target);
    },
    getSnapshot(): ServiceDirectorySnapshot {
      return snapshot;
    },
    join(): Promise<ServiceDirectorySnapshot> {
      return Promise.resolve(snapshot);
    },
    refresh(): Promise<ServiceDirectorySnapshot> {
      return Promise.resolve(snapshot);
    },
    renew(): Promise<ServiceDirectorySnapshot> {
      return Promise.resolve(snapshot);
    },
    resolveProcedure(procedure) {
      throw new Error(`Procedure is not registered in fake Service Directory: ${procedure}`);
    }
  };
}

function startProviderAssetServer(assets: Record<string, string>): Promise<Server> {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const body = assets[path];
    if (body === undefined) {
      response.writeHead(404, {
        'content-type': 'text/plain; charset=utf-8'
      });
      response.end('Not Found');
      return;
    }
    response.writeHead(200, {
      'content-type': path.endsWith('.css')
        ? 'text/css; charset=utf-8'
        : 'text/javascript; charset=utf-8'
    });
    response.end(body);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

function closeServer(server: Server): Promise<void> {
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

function serverUrl(server: Server): string {
  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('Server is not listening on a TCP port');
  }
  return `http://127.0.0.1:${String(address.port)}`;
}
