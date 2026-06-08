import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  httpRpc,
  type EventBus,
  type EventEnvelope,
  type EventSubscription,
  type RegistryClient,
  type Snapshot
} from '@agentg/framework';
import { WebSocket, type RawData } from 'ws';
import { describe, expect, it, vi } from 'vitest';

import { startServer, type ServerConfig } from '../src/server/server.js';

describe('Control Plane server boundary', () => {
  it('routes browser RPC through local procedures and forwards events', async () => {
    const events = createFakeEventBus();
    const registry = createFakeRegistry({
      modules: [],
      version: 0
    });
    const localProcedure = vi.fn(() =>
      Promise.resolve({
        items: 3,
        records: 5
      })
    );

    const server = await startServer({
      config: testServerConfig(),
      events,
      procedures: {
        'cp.getStatus': localProcedure
      },
      registry
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      socket.send(JSON.stringify({ id: 1, method: 'cp.getStatus', params: { limit: 10 } }));

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        id: 1,
        result: {
          items: 3,
          records: 5
        }
      });
      expect(localProcedure).toHaveBeenCalledWith({ limit: 10 });

      const event = eventEnvelope('beta.coverage.changed', {
        recordId: 'record-a'
      });
      await events.emit(event);

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        event: {
          data: {
            recordId: 'record-a'
          },
          id: event.id,
          occurredAt: event.at,
          type: 'beta.coverage.changed'
        }
      });
    } finally {
      socket.close();
      await server.close();
      registry.close();
    }
  });

  it('routes browser RPC through registry module procedures', async () => {
    const events = createFakeEventBus();
    const moduleServer = await httpRpc({ port: 0 }).start({
      getStatus: (...args: never[]) =>
        Promise.resolve({
          input: args[0],
          ok: true
        })
    });
    const registry = createFakeRegistry({
      modules: [
        {
          module: 'beta',
          procedures: ['getStatus'],
          registeredAt: '2026-05-04T00:00:00.000Z',
          required: false,
          rpcUrl: moduleServer.url
        }
      ],
      version: 1
    });
    const refresh = vi.spyOn(registry, 'refresh');

    const server = await startServer({
      config: testServerConfig(),
      events,
      registry
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      socket.send(JSON.stringify({ id: 1, method: 'beta.getStatus', params: { limit: 10 } }));

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        id: 1,
        result: {
          input: {
            limit: 10
          },
          ok: true
        }
      });
      expect(refresh).not.toHaveBeenCalled();
    } finally {
      socket.close();
      await server.close();
      registry.close();
      await moduleServer.stop();
    }
  });

  it('returns procedure failures as RPC errors', async () => {
    const events = createFakeEventBus();
    const registry = createFakeRegistry({
      modules: [],
      version: 0
    });

    const server = await startServer({
      config: testServerConfig(),
      events,
      procedures: {
        'cp.fail': () => Promise.reject(new Error('Procedure failed'))
      },
      registry
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      socket.send(JSON.stringify({ id: 2, method: 'cp.fail', params: {} }));

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
      registry.close();
    }
  });

  it('serves the Vue runtime endpoint', async () => {
    const events = createFakeEventBus();
    const registry = createFakeRegistry({
      modules: [],
      version: 0
    });

    const server = await startServer({
      config: testServerConfig(),
      events,
      registry
    });

    try {
      const runtimeResponse = await fetch(
        `http://127.0.0.1:${String(server.port)}/control-plane/runtime/vue.js`
      );
      expect(runtimeResponse.status).toBe(200);
      await expect(runtimeResponse.text()).resolves.toContain('__VUE_HMR_RUNTIME__');
    } finally {
      await server.close();
      registry.close();
    }
  });

  it('serves the browser app entry for nested page routes', async () => {
    const staticDir = await mkdtemp(join(tmpdir(), 'agentg-control-plane-'));
    await writeFile(join(staticDir, 'index.html'), '<div id="controlPlaneApp"></div>');
    const events = createFakeEventBus();
    const registry = createFakeRegistry({
      modules: [],
      version: 0
    });

    const server = await startServer({
      config: testServerConfig({ staticDir }),
      events,
      registry
    });

    try {
      const clientResponse = await fetch(
        `http://127.0.0.1:${String(server.port)}/client/chats/-100123`
      );
      expect(clientResponse.status).toBe(200);
      expect(clientResponse.headers.get('content-type')).toBe('text/html; charset=utf-8');
      await expect(clientResponse.text()).resolves.toBe('<div id="controlPlaneApp"></div>');

      const nestedPageResponse = await fetch(
        `http://127.0.0.1:${String(server.port)}/reports/latency`
      );
      expect(nestedPageResponse.status).toBe(200);
      await expect(nestedPageResponse.text()).resolves.toBe('<div id="controlPlaneApp"></div>');
    } finally {
      await server.close();
      registry.close();
      await rm(staticDir, { force: true, recursive: true });
    }
  });

  it('proxies module file URLs through the module file procedure', async () => {
    const events = createFakeEventBus();
    const moduleServer = await httpRpc({ port: 0 }).start({
      'cp.file': (...args: never[]) => {
        const input = args[0] as unknown;
        if (isFileRequest(input) && input.path === '/assets/icon.svg') {
          return Promise.resolve({
            bodyBase64: Buffer.from('<svg />').toString('base64'),
            contentType: 'image/svg+xml'
          });
        }
        throw new Error('File not found');
      }
    });
    const registry = createFakeRegistry({
      modules: [
        {
          module: 'alpha',
          procedures: ['cp.file'],
          registeredAt: '2026-05-04T00:00:00.000Z',
          required: false,
          rpcUrl: moduleServer.url
        }
      ],
      version: 1
    });

    const server = await startServer({
      config: testServerConfig(),
      events,
      registry
    });

    try {
      const response = await fetch(
        `http://127.0.0.1:${String(server.port)}/control-plane/module-files/alpha/assets/icon.svg`
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/svg+xml');
      await expect(response.text()).resolves.toBe('<svg />');

      await expect(
        fetch(
          `http://127.0.0.1:${String(server.port)}/control-plane/module-files/alpha/assets/missing.svg`
        ).then((missing) => missing.status)
      ).resolves.toBe(404);
    } finally {
      await server.close();
      registry.close();
      await moduleServer.stop();
    }
  });

  it('closes browser WebSocket connections that send oversized payloads', async () => {
    const events = createFakeEventBus();
    const registry = createFakeRegistry({
      modules: [],
      version: 0
    });
    const server = await startServer({
      config: testServerConfig(),
      events,
      registry
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      const close = nextClose(socket);
      socket.send('x'.repeat(1_000_001));

      await expect(close).resolves.toBe(1009);
    } finally {
      socket.close();
      await server.close();
      registry.close();
    }
  });
});

type FakeEventBus = EventBus & {
  emit(event: EventEnvelope): Promise<void>;
};

function testServerConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    host: '127.0.0.1',
    port: 0,
    staticDir: '/tmp/agentg-control-plane-test-missing',
    ...overrides
  };
}

function createFakeEventBus(): FakeEventBus {
  const subscriptions = new Map<
    number,
    {
      handler: (event: EventEnvelope) => void | Promise<void>;
      subject: string;
    }
  >();
  let nextId = 1;

  return {
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
    start(): Promise<void> {
      return Promise.resolve();
    },
    stop(): Promise<void> {
      return Promise.resolve();
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

function eventEnvelope(type: string, data: unknown): EventEnvelope {
  return {
    at: '2026-05-05T00:00:00.000Z',
    data,
    id: `event:${type}`,
    trace: {},
    type
  };
}

function matchesSubject(subject: string, type: string): boolean {
  if (subject === '>') {
    return true;
  }
  if (subject.endsWith('>')) {
    return type.startsWith(subject.slice(0, -1));
  }

  return subject === type;
}

function createFakeRegistry(
  initialSnapshot: Snapshot,
  refreshedSnapshot: Snapshot = initialSnapshot
): RegistryClient {
  let snapshot = initialSnapshot;
  return {
    close(): void {
      return;
    },
    getSnapshot(): Snapshot {
      return snapshot;
    },
    join(): Promise<Snapshot> {
      return Promise.resolve(snapshot);
    },
    refresh(): Promise<Snapshot> {
      snapshot = refreshedSnapshot;
      return Promise.resolve(snapshot);
    }
  };
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

function nextClose(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    socket.once('close', (code) => {
      resolve(code);
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

function isFileRequest(value: unknown): value is { path: string } {
  return (
    typeof value === 'object' && value !== null && 'path' in value && typeof value.path === 'string'
  );
}
