import { describe, expect, it } from 'vitest';

import {
  defineConfig,
  defineModule,
  httpRpc,
  selfRegistry,
  registry,
  registryModule,
  type EventBus,
  type EventBusFactory,
  type Snapshot
} from '../src/index.js';
import { startProcedureServer } from '../src/rpc/httpRpc.js';
import { createRegistryClient, procedureUrls } from '../src/registry/client.js';
import { createRegistry } from '../src/registry/registry.js';

const readEmptyConfig = defineConfig({});

describe('registry', () => {
  it('stores manifests without procedure kind', () => {
    const registry = createRegistry();

    const snapshot = registry.join(
      {
        procedures: ['telegram.getChat', 'telegram.listChats', 'telegram.getChat'],
        required: true,
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      },
      new Date('2026-05-30T00:00:00.000Z')
    );

    expect(snapshot).toEqual({
      modules: [
        {
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

  it('keeps joined modules until a new manifest replaces them', () => {
    const registry = createRegistry();
    const joined = registry.join(
      {
        procedures: ['telegram.getChat'],
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      },
      new Date('2026-05-30T00:00:00.000Z')
    );
    const rejoined = registry.join(
      {
        procedures: ['telegram.getChat'],
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      },
      new Date('2026-05-30T00:00:00.500Z')
    );

    expect(rejoined).toEqual(joined);
    expect(registry.getSnapshot().modules).toHaveLength(1);
  });

  it('exposes registry procedures through the framework transport', async () => {
    const app = registryModule({
      config: {},
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
        result: Snapshot;
      };

      expect(body.ok).toBe(true);
      expect(body.result.modules[0]?.procedures).toEqual(['telegram.getChat']);
    } finally {
      await server.stop();
    }
  });

  it('joins, refreshes, and exposes procedure lookup helpers', async () => {
    const app = registryModule({
      config: {},
      connect: testConnect()
    });
    const server = await startProcedureServer(app.procedures, { port: 0 });
    const client = createRegistryClient({
      url: server.url
    });

    try {
      const snapshot = await client.join({
        procedures: ['telegram.getChat'],
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      });

      expect(snapshot.modules).toHaveLength(1);
      expect(procedureUrls(snapshot)).toEqual(
        new Map([['telegram.getChat', 'http://127.0.0.1:9000']])
      );
      await expect(client.refresh()).resolves.toEqual(client.getSnapshot());
    } finally {
      client.close();
      await server.stop();
    }
  });

  it('fails refresh when a required startup module disappears', async () => {
    const server = await startProcedureServer(requiredThenEmptyRegistryProcedures(), { port: 0 });
    const client = createRegistryClient({
      url: server.url
    });

    try {
      await client.join({
        required: true,
        rpcUrl: 'http://127.0.0.1:9000',
        module: 'telegram'
      });

      await expect(client.refresh()).rejects.toThrow(
        'Required module disappeared from Registry: telegram'
      );
    } finally {
      client.close();
      await server.stop();
    }
  });

  it('registers module surfaces during framework startup', async () => {
    const registryApp = registryModule({
      config: {},
      connect: testConnect()
    });
    const registryServer = await startProcedureServer(registryApp.procedures, { port: 0 });
    const app = defineModule('telegram', {
      config: readEmptyConfig,
      setup: () => ({
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
    } finally {
      await app.stop();
      await registryServer.stop();
    }
  });
});

function createRecordingEventBus(): EventBus {
  return {
    start() {
      return Promise.resolve();
    },
    stop() {
      return Promise.resolve();
    },
    publish() {
      return;
    },
    subscribe() {
      return {
        unsubscribe() {
          return;
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

function requiredThenEmptyRegistryProcedures(): {
  getSnapshot(): Snapshot;
  join(input: unknown): Snapshot;
} {
  const requiredSnapshot: Snapshot = {
    modules: [
      {
        module: 'telegram',
        procedures: [],
        registeredAt: '2026-05-30T00:00:00.000Z',
        required: true,
        rpcUrl: 'http://127.0.0.1:9000'
      }
    ],
    version: 1
  };
  const emptySnapshot: Snapshot = {
    modules: [],
    version: 2
  };

  return {
    getSnapshot() {
      return emptySnapshot;
    },
    join() {
      return requiredSnapshot;
    }
  };
}
