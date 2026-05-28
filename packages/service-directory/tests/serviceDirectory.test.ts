import type { Server } from 'node:http';

import type { EventBus, EventSubscription } from '@agentg/events/bus';
import type { IntegrationEvent } from '@agentg/events/envelope';
import { collectModelRefs } from '@agentg/framework/model-refs';
import { afterEach, describe, expect, it } from 'vitest';

import { createServiceDirectory } from '../src/registry.js';
import { createServiceDirectoryClient } from '../src/rpc/serviceDirectoryClient.js';
import { startServiceDirectoryTrpcServer } from '../src/rpc/server.js';

const servers: Server[] = [];

describe('service directory', () => {
  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer));
  });

  it('joins services, publishes versioned snapshots, and expires leases', () => {
    const directory = createServiceDirectory({ ttlMs: 1000 });
    const joinedAt = new Date('2026-05-04T00:00:00.000Z');
    const refreshedAt = new Date('2026-05-04T00:00:00.500Z');

    const joined = directory.join(
      {
        controlPlane: {
          assetVersion: 'asset-v1',
          contents: [
            {
              contentId: 'analytics.tile',
              module: {
                assetPath: 'tile.js'
              },
              tags: ['dashboard.tile']
            }
          ]
        },
        events: ['analytics.report.completed'],
        extensions: [
          {
            extension: 'analytics.chatInsights',
            target: 'telegram.chat'
          }
        ],
        procedures: [{ kind: 'query', name: 'analytics.chatInsights' }],
        required: false,
        rpcUrl: 'http://analytics:8080',
        slug: 'analytics'
      },
      joinedAt
    );

    expect(joined.changed).toBe(true);
    expect(joined.output.snapshot).toMatchObject({
      extensions: [
        {
          extension: 'analytics.chatInsights',
          rpcUrl: 'http://analytics:8080',
          serviceSlug: 'analytics',
          target: 'telegram.chat'
        }
      ],
      services: [
        {
          controlPlane: {
            assetVersion: 'asset-v1',
            contents: [
              {
                contentId: 'analytics.tile',
                module: {
                  assetPath: 'tile.js'
                },
                tags: ['dashboard.tile']
              }
            ]
          },
          events: ['analytics.report.completed'],
          procedures: [{ kind: 'query', name: 'analytics.chatInsights' }],
          rpcUrl: 'http://analytics:8080',
          slug: 'analytics'
        }
      ],
      version: 1
    });

    const renewed = directory.renew(
      {
        leaseToken: joined.output.lease.leaseToken,
        slug: 'analytics'
      },
      refreshedAt
    );

    expect(renewed.changed).toBe(false);
    expect(renewed.output.snapshot.version).toBe(1);
    const updated = directory.join(
      {
        controlPlane: {
          assetVersion: 'asset-v2',
          contents: [
            {
              contentId: 'analytics.tile',
              module: {
                assetPath: 'tile.js'
              },
              tags: ['dashboard.tile']
            }
          ]
        },
        events: ['analytics.report.completed'],
        extensions: [
          {
            extension: 'analytics.chatInsights',
            target: 'telegram.chat'
          }
        ],
        procedures: [{ kind: 'query', name: 'analytics.chatInsights' }],
        required: false,
        rpcUrl: 'http://analytics:8080',
        slug: 'analytics'
      },
      refreshedAt
    );

    expect(updated.changed).toBe(true);
    expect(updated.output.snapshot.version).toBe(2);
    expect(directory.getSnapshot(new Date('2026-05-04T00:00:01.501Z')).output.services).toEqual([]);
    expect(directory.getSnapshot(new Date('2026-05-04T00:00:01.501Z')).output.version).toBe(3);
  });

  it('exposes join, renew, and snapshot through tRPC and publishes invalidations', async () => {
    const eventBus = createFakeEventBus();
    const server = await startServiceDirectoryTrpcServer({
      bind: {
        host: '127.0.0.1',
        port: 0
      },
      directory: createServiceDirectory({ ttlMs: 60_000 }),
      eventBus
    });
    servers.push(server);
    const client = createServiceDirectoryClient({
      eventBus,
      url: serverUrl(server)
    });

    try {
      await expect(
        client.join({
          events: ['analytics.report.completed'],
          extensions: [
            {
              extension: 'analytics.chatInsights',
              target: 'telegram.chat'
            }
          ],
          procedures: [{ kind: 'query', name: 'analytics.chatInsights' }],
          required: false,
          rpcUrl: 'http://analytics:8080',
          slug: 'analytics'
        })
      ).resolves.toMatchObject({
        services: [
          {
            slug: 'analytics'
          }
        ],
        version: 1
      });

      expect(eventBus.publishedTypes()).toEqual(['service_directory.changed']);
      expect(client.resolveProcedure('analytics.chatInsights')).toEqual({
        kind: 'query',
        rpcUrl: 'http://analytics:8080'
      });
      expect(client.extensionsForTarget('telegram.chat')).toEqual([
        expect.objectContaining({
          extension: 'analytics.chatInsights',
          serviceSlug: 'analytics',
          target: 'telegram.chat'
        })
      ]);

      await expect(client.renew()).resolves.toMatchObject({
        version: 1
      });
    } finally {
      client.close();
    }
  });

  it('resolves procedures only through their service prefix owner', async () => {
    const eventBus = createFakeEventBus();
    const server = await startServiceDirectoryTrpcServer({
      bind: {
        host: '127.0.0.1',
        port: 0
      },
      directory: createServiceDirectory({ ttlMs: 60_000 }),
      eventBus
    });
    servers.push(server);
    const client = createServiceDirectoryClient({
      eventBus,
      url: serverUrl(server)
    });

    try {
      await client.join({
        events: [],
        extensions: [],
        procedures: [{ kind: 'query', name: 'telegram.getChat' }],
        required: false,
        rpcUrl: 'http://analytics:8080',
        slug: 'analytics'
      });

      expect(() => client.resolveProcedure('telegram.getChat')).toThrow(
        'Dependency is unavailable: telegram.getChat'
      );
    } finally {
      client.close();
    }
  });

  it('sweeps expired leases and publishes invalidations without client requests', async () => {
    const eventBus = createFakeEventBus();
    const directory = createServiceDirectory({ ttlMs: 20 });
    directory.join({
      events: ['telegram.status'],
      extensions: [],
      procedures: [{ kind: 'query', name: 'telegram.getChat' }],
      required: true,
      rpcUrl: 'http://telegram:8080',
      slug: 'telegram'
    });
    const server = await startServiceDirectoryTrpcServer({
      bind: {
        host: '127.0.0.1',
        port: 0
      },
      directory,
      eventBus,
      ttlMs: 20
    });
    servers.push(server);

    await waitForPublishedType(eventBus, 'service_directory.changed');

    expect(eventBus.publishedTypes()).toEqual(['service_directory.changed']);
    expect(directory.getSnapshot().output).toMatchObject({
      services: [],
      version: 2
    });
  });

  it('reports topology failure when a previously seen required service expires', async () => {
    const eventBus = createFakeEventBus();
    const directory = createServiceDirectory({ ttlMs: 20 });
    directory.join({
      events: ['telegram.status'],
      extensions: [],
      procedures: [{ kind: 'query', name: 'telegram.getChat' }],
      required: true,
      rpcUrl: 'http://telegram:8080',
      slug: 'telegram'
    });
    const server = await startServiceDirectoryTrpcServer({
      bind: {
        host: '127.0.0.1',
        port: 0
      },
      directory,
      eventBus,
      ttlMs: 20
    });
    servers.push(server);
    const failures: Error[] = [];
    const client = createServiceDirectoryClient({
      eventBus,
      onTopologyFailure(error) {
        failures.push(error);
      },
      url: serverUrl(server)
    });

    try {
      await expect(client.refresh()).resolves.toMatchObject({
        services: [
          {
            required: true,
            slug: 'telegram'
          }
        ]
      });

      await waitForFailure(failures);

      expect(failures).toHaveLength(1);
      expect(failures[0]?.message).toBe(
        'Required services disappeared from Service Directory: telegram'
      );
    } finally {
      client.close();
    }
  });
});

describe('collectModelRefs', () => {
  it('collects unique model refs from nested JSON-shaped values', () => {
    const circular: Record<string, unknown> = {
      _model: 'telegram.chat',
      id: 'chat-a',
      title: 'Chat A'
    };
    circular.self = circular;

    expect(
      collectModelRefs({
        chat: circular,
        invalid: {
          _model: 'telegram.chat'
        },
        items: [
          {
            _model: 'telegram.chat',
            id: 'chat-a'
          },
          {
            _model: 'telegram.message',
            id: 'message-a'
          },
          {
            id: 'missing-model'
          }
        ]
      })
    ).toEqual([
      {
        _model: 'telegram.chat',
        id: 'chat-a'
      },
      {
        _model: 'telegram.message',
        id: 'message-a'
      }
    ]);
  });
});

type TestEventBus = EventBus & {
  publishedTypes(): string[];
};

function createFakeEventBus(): TestEventBus {
  const published: IntegrationEvent[] = [];
  const handlers = new Map<string, (event: IntegrationEvent) => void | Promise<void>>();

  return {
    close(): Promise<void> {
      return Promise.resolve();
    },
    publish(event): void {
      published.push(event);
      void handlers.get(event.type)?.(event);
    },
    publishedTypes(): string[] {
      return published.map((event) => event.type);
    },
    subscribe(subject, handler): EventSubscription {
      handlers.set(subject, handler);
      return {
        unsubscribe(): void {
          handlers.delete(subject);
        }
      };
    }
  };
}

function serverUrl(server: Server): string {
  const address = server.address();
  if (typeof address === 'object' && address !== null) {
    return `http://127.0.0.1:${String(address.port)}`;
  }

  throw new Error('Expected TCP server address');
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }

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

async function waitForPublishedType(eventBus: TestEventBus, type: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (eventBus.publishedTypes().includes(type)) {
      return;
    }
    await delay(10);
  }

  throw new Error(`Expected published event type: ${type}`);
}

async function waitForFailure(failures: Error[]): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (failures.length > 0) {
      return;
    }
    await delay(10);
  }

  throw new Error('Expected topology failure');
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
