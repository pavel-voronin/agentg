import { setTimeout as delay } from 'node:timers/promises';

import { describe, expect, it, vi } from 'vitest';

import {
  defineConfig,
  defineModule,
  httpRpc,
  selfRegistry,
  registry,
  registryModule,
  type EventBus,
  type EventBusFactory,
  type EventEnvelope,
  type Snapshot
} from '../src/index.js';
import { startProcedureServer } from '../src/rpc/httpRpc.js';
import {
  createRegistryClient,
  extensionsForTarget,
  procedureUrls
} from '../src/registry/client.js';
import { CHANGED_EVENT as REGISTRY_CHANGED_EVENT } from '../src/registry/contracts.js';
import { createRegistry } from '../src/registry/registry.js';

const readEmptyConfig = defineConfig({});

describe('registry', () => {
  it('stores manifests without procedure kind', () => {
    const registry = createRegistry({ ttlMs: 1000 });

    const output = registry.join(
      {
        procedures: ['telegram.getChat', 'telegram.listChats', 'telegram.getChat'],
        required: true,
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      },
      new Date('2026-05-30T00:00:00.000Z')
    );

    expect(output.snapshot).toEqual({
      modules: [
        {
          expiresAt: '2026-05-30T00:00:01.000Z',
          extensions: [],
          procedures: ['telegram.getChat', 'telegram.listChats'],
          registeredAt: '2026-05-30T00:00:00.000Z',
          required: true,
          rpcUrl: 'http://127.0.0.1:9000',
          module: 'telegram'
        }
      ],
      version: 1
    });
  });

  it('renews an active lease', () => {
    const registry = createRegistry({ ttlMs: 1000 });
    const joined = registry.join(
      {
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      },
      new Date('2026-05-30T00:00:00.000Z')
    );

    const renewed = registry.renew(
      {
        leaseToken: joined.lease.leaseToken,
        module: 'telegram'
      },
      new Date('2026-05-30T00:00:00.500Z')
    );

    expect(renewed.lease.expiresAt).toBe('2026-05-30T00:00:01.500Z');
    expect(renewed.snapshot.modules).toHaveLength(1);
  });

  it('exposes registry procedures through the framework transport', async () => {
    const app = registryModule({
      config: {
        ttlMs: 1000
      },
      connect: testConnect()
    });
    const server = await startProcedureServer(app.procedures, { port: 0 });

    try {
      const response = await fetch(`${server.url}/rpc`, {
        body: JSON.stringify({
          input: {
            procedures: ['telegram.getChat'],
            rpcUrl: 'http://127.0.0.1:9000',
            module: 'telegram'
          },
          procedure: 'join'
        }),
        headers: {
          'content-type': 'application/json'
        },
        method: 'POST'
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        ok: true;
        result: {
          snapshot: {
            modules: {
              procedures: string[];
            }[];
          };
        };
      };

      expect(body.ok).toBe(true);
      expect(body.result.snapshot.modules[0]?.procedures).toEqual(['telegram.getChat']);
    } finally {
      await server.stop();
    }
  });

  it('joins, refreshes, and exposes snapshot lookup helpers', async () => {
    const app = registryModule({
      config: {
        ttlMs: undefined
      },
      connect: testConnect()
    });
    const server = await startProcedureServer(app.procedures, { port: 0 });
    const client = createRegistryClient({
      events: createRecordingEventBus(),
      renewIntervalMs: 10_000,
      url: server.url
    });

    try {
      const snapshot = await client.join({
        extensions: [
          {
            extension: 'telegram.chat.card',
            target: 'telegram.chat'
          },
          {
            extension: 'telegram.message.card',
            target: 'telegram.message'
          }
        ],
        procedures: ['telegram.getChat'],
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      });

      expect(snapshot.modules).toHaveLength(1);
      expect(procedureUrls(snapshot)).toEqual(
        new Map([['telegram.getChat', 'http://127.0.0.1:9000']])
      );
      expect(extensionsForTarget(snapshot, 'telegram.chat')).toEqual([
        {
          expiresAt: expect.any(String) as string,
          extension: 'telegram.chat.card',
          registeredAt: expect.any(String) as string,
          rpcUrl: 'http://127.0.0.1:9000',
          module: 'telegram',
          target: 'telegram.chat'
        }
      ]);
      await expect(client.refresh()).resolves.toEqual(client.getSnapshot());
    } finally {
      client.close();
      await server.stop();
    }
  });

  it('renews the current lease automatically', async () => {
    const app = registryModule({
      config: {
        ttlMs: 100
      },
      connect: testConnect()
    });
    const server = await startProcedureServer(app.procedures, { port: 0 });
    const client = createRegistryClient({
      events: createRecordingEventBus(),
      renewIntervalMs: 20,
      url: server.url
    });

    try {
      await client.join({
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      });
      await delay(150);

      const snapshot = await client.refresh();

      expect(snapshot.modules.map((item) => item.module)).toEqual(['telegram']);
    } finally {
      client.close();
      await server.stop();
    }
  });

  it('logs background renew failures when no failure callback is configured', async () => {
    const errors: string[] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation((message) => {
      errors.push(String(message));
    });
    const app = registryModule({
      config: {
        ttlMs: undefined
      },
      connect: testConnect()
    });
    const server = await startProcedureServer(app.procedures, { port: 0 });
    const client = createRegistryClient({
      events: createRecordingEventBus(),
      renewIntervalMs: 10,
      url: server.url
    });

    try {
      await client.join({
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      });
      await server.stop();

      await waitUntil(() =>
        errors.some(
          (message) => (JSON.parse(message) as { event: string }).event === 'registry.renew_failed'
        )
      );
    } finally {
      client.close();
      consoleError.mockRestore();
    }
  });

  it('refreshes when a changed event arrives', async () => {
    const app = registryModule({
      config: {
        ttlMs: undefined
      },
      connect: testConnect()
    });
    const server = await startProcedureServer(app.procedures, { port: 0 });
    const events = createRecordingEventBus();
    const client = createRegistryClient({
      events,
      renewIntervalMs: 10_000,
      url: server.url
    });

    try {
      await client.join({
        procedures: ['telegram.getChat'],
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      });
      await callJoin(server.url, {
        procedures: ['history-sync.listTargets'],
        rpcUrl: 'http://127.0.0.1:9001',
        module: 'history-sync'
      });

      events.emit(REGISTRY_CHANGED_EVENT, {
        version: 2
      });
      await delay(10);

      expect(client.getSnapshot().modules.map((item) => item.module)).toEqual([
        'history-sync',
        'telegram'
      ]);
    } finally {
      client.close();
      await server.stop();
    }
  });

  it('fails refresh when a required startup module disappears', async () => {
    const app = registryModule({
      config: {
        ttlMs: 20
      },
      connect: testConnect()
    });
    const server = await startProcedureServer(app.procedures, { port: 0 });
    const client = createRegistryClient({
      events: createRecordingEventBus(),
      renewIntervalMs: 10_000,
      url: server.url
    });

    try {
      await client.join({
        required: true,
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      });
      await delay(30);

      await expect(client.refresh()).rejects.toThrow(
        'Required module disappeared from Registry: telegram'
      );
    } finally {
      client.close();
      await server.stop();
    }
  });

  it('reports topology failures from changed event refreshes', async () => {
    const failures: string[] = [];
    const app = registryModule({
      config: {
        ttlMs: 20
      },
      connect: testConnect()
    });
    const server = await startProcedureServer(app.procedures, { port: 0 });
    const events = createRecordingEventBus();
    const client = createRegistryClient({
      events,
      onTopologyFailure(error) {
        failures.push(error.message);
      },
      renewIntervalMs: 10_000,
      url: server.url
    });

    try {
      await client.join({
        required: true,
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      });
      await delay(30);

      events.emit(REGISTRY_CHANGED_EVENT, {
        version: 2
      });
      await delay(10);

      expect(failures).toEqual(['Required module disappeared from Registry: telegram']);
    } finally {
      client.close();
      await server.stop();
    }
  });

  it('logs topology failures from changed event refreshes when no callback is configured', async () => {
    const errors: string[] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation((message) => {
      errors.push(String(message));
    });
    const app = registryModule({
      config: {
        ttlMs: 20
      },
      connect: testConnect()
    });
    const server = await startProcedureServer(app.procedures, { port: 0 });
    const events = createRecordingEventBus();
    const client = createRegistryClient({
      events,
      renewIntervalMs: 10_000,
      url: server.url
    });

    try {
      await client.join({
        required: true,
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      });
      await delay(30);

      events.emit(REGISTRY_CHANGED_EVENT, {
        version: 2
      });
      await waitUntil(() =>
        errors.some(
          (message) =>
            (JSON.parse(message) as { error: string; event: string }).event ===
              'registry.topology_failed' &&
            (JSON.parse(message) as { error: string; event: string }).error ===
              'Required module disappeared from Registry: telegram'
        )
      );
    } finally {
      client.close();
      consoleError.mockRestore();
      await server.stop();
    }
  });

  it('registers module surfaces during framework startup', async () => {
    const registryApp = registryModule({
      config: {
        ttlMs: undefined
      },
      connect: testConnect()
    });
    const registryServer = await startProcedureServer(registryApp.procedures, { port: 0 });
    const app = defineModule('telegram', {
      config: readEmptyConfig,
      setup: () => ({
        extensions: [
          {
            extension: 'telegram.chat.card',
            target: 'telegram.chat'
          }
        ],
        procedures: {
          status: () => ({
            ready: true
          })
        },
        required: true
      })
    })({
      config: {},
      connect: {
        events: testEventBus(),
        rpc: httpRpc({ port: 0 }),
        registry: registry(registryServer.url)
      }
    });

    try {
      await app.start();
      const snapshot = await callSnapshot(registryServer.url);

      expect(snapshot.modules).toEqual([
        expect.objectContaining({
          procedures: ['status'],
          required: true,
          module: 'telegram'
        })
      ]);
      expect(extensionsForTarget(snapshot, 'telegram.chat')).toHaveLength(1);
    } finally {
      await app.stop();
      await registryServer.stop();
    }
  });
});

function createRecordingEventBus(): EventBus & {
  emit(type: string, data: unknown): void;
} {
  const handlers = new Map<string, (event: EventEnvelope) => void | Promise<void>>();

  return {
    emit(type, data) {
      void handlers.get(type)?.({
        at: new Date().toISOString(),
        data,
        id: 'evt_test',
        type
      });
    },
    start() {
      return Promise.resolve();
    },
    stop() {
      return Promise.resolve();
    },
    publish() {
      return;
    },
    subscribe(subject, handler) {
      handlers.set(subject, handler);
      return {
        unsubscribe() {
          handlers.delete(subject);
        }
      };
    }
  };
}

function testEventBus(): EventBusFactory {
  return () => ({
    ...createRecordingEventBus()
  });
}

function testConnect() {
  return {
    events: testEventBus(),
    rpc: httpRpc({ port: 0 }),
    registry: selfRegistry()
  };
}

async function callJoin(
  url: string,
  input: {
    procedures: string[];
    rpcUrl: string;
    module: string;
  }
): Promise<void> {
  const response = await fetch(`${url}/rpc`, {
    body: JSON.stringify({
      input,
      procedure: 'join'
    }),
    headers: {
      'content-type': 'application/json'
    },
    method: 'POST'
  });

  expect(response.status).toBe(200);
}

async function callSnapshot(url: string): Promise<Snapshot> {
  const response = await fetch(`${url}/rpc`, {
    body: JSON.stringify({
      procedure: 'getSnapshot'
    }),
    headers: {
      'content-type': 'application/json'
    },
    method: 'POST'
  });

  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    ok: true;
    result: Snapshot;
  };
  return body.result;
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) {
      return;
    }
    await delay(10);
  }

  throw new Error('Timed condition did not pass');
}
