import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ProcedureTransportError,
  type EventBus,
  type EventEnvelope,
  type EventSubscription
} from '@agentg/framework';
import { WebSocket, type RawData } from 'ws';
import { describe, expect, it, vi } from 'vitest';

import { startServer, type ServerConfig } from '../src/server/server.js';

describe('Dashboard server boundary', () => {
  it('routes browser RPC through local procedures and forwards events', async () => {
    const events = createFakeEventBus();
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
        'dashboard.getStatus': localProcedure
      }
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      socket.send(JSON.stringify({ id: 1, method: 'dashboard.getStatus', params: { limit: 10 } }));

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
    }
  });

  it('rejects browser RPC methods without a registered Dashboard procedure', async () => {
    const events = createFakeEventBus();

    const server = await startServer({
      config: testServerConfig(),
      events
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      socket.send(JSON.stringify({ id: 1, method: 'beta.getStatus', params: { limit: 10 } }));

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        id: 1,
        error: {
          code: 'method_failed',
          message: 'Dashboard procedure is not registered: beta.getStatus'
        }
      });
    } finally {
      socket.close();
      await server.close();
    }
  });

  it('returns procedure failures as RPC errors', async () => {
    const events = createFakeEventBus();

    const server = await startServer({
      config: testServerConfig(),
      events,
      procedures: {
        'dashboard.fail': () => Promise.reject(new Error('Procedure failed'))
      }
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      socket.send(JSON.stringify({ id: 2, method: 'dashboard.fail', params: {} }));

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

  it('returns dependency_unavailable when a Dashboard procedure dependency is absent', async () => {
    const events = createFakeEventBus();

    const server = await startServer({
      config: testServerConfig(),
      events,
      procedures: {
        'dashboard.failDependency': () =>
          Promise.reject(new ProcedureTransportError('Procedure transport failed: fetch failed'))
      }
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      socket.send(JSON.stringify({ id: 3, method: 'dashboard.failDependency', params: {} }));

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        id: 3,
        error: {
          code: 'dependency_unavailable',
          message: 'Procedure transport failed: fetch failed'
        }
      });
    } finally {
      socket.close();
      await server.close();
    }
  });

  it('serves the Vue runtime endpoint', async () => {
    const events = createFakeEventBus();

    const server = await startServer({
      config: testServerConfig(),
      events
    });

    try {
      const runtimeResponse = await fetch(
        `http://127.0.0.1:${String(server.port)}/dashboard/runtime/vue.js`
      );
      expect(runtimeResponse.status).toBe(200);
      await expect(runtimeResponse.text()).resolves.toContain('__VUE_HMR_RUNTIME__');
    } finally {
      await server.close();
    }
  });

  it('serves the browser app entry for nested page routes', async () => {
    const staticDir = await mkdtemp(join(tmpdir(), 'agentg-dashboard-'));
    await writeFile(join(staticDir, 'index.html'), '<div id="dashboardApp"></div>');
    const events = createFakeEventBus();

    const server = await startServer({
      config: testServerConfig({ staticDir }),
      events
    });

    try {
      const clientResponse = await fetch(
        `http://127.0.0.1:${String(server.port)}/client/chats/-100123`
      );
      expect(clientResponse.status).toBe(200);
      expect(clientResponse.headers.get('content-type')).toBe('text/html; charset=utf-8');
      await expect(clientResponse.text()).resolves.toBe('<div id="dashboardApp"></div>');

      const nestedPageResponse = await fetch(
        `http://127.0.0.1:${String(server.port)}/reports/latency`
      );
      expect(nestedPageResponse.status).toBe(200);
      await expect(nestedPageResponse.text()).resolves.toBe('<div id="dashboardApp"></div>');
    } finally {
      await server.close();
      await rm(staticDir, { force: true, recursive: true });
    }
  });

  it('returns not found for missing asset-like paths instead of the app entry', async () => {
    const staticDir = await mkdtemp(join(tmpdir(), 'agentg-dashboard-'));
    await writeFile(join(staticDir, 'index.html'), '<div id="dashboardApp"></div>');
    const events = createFakeEventBus();

    const server = await startServer({
      config: testServerConfig({ staticDir }),
      events
    });

    try {
      const response = await fetch(`http://127.0.0.1:${String(server.port)}/assets/missing.jpg`);
      expect(response.status).toBe(404);
      await expect(response.text()).resolves.toBe('Not Found');
    } finally {
      await server.close();
      await rm(staticDir, { force: true, recursive: true });
    }
  });

  it('rejects module file routes instead of proxying module RPC', async () => {
    const events = createFakeEventBus();

    const server = await startServer({
      config: testServerConfig(),
      events
    });

    try {
      const response = await fetch(
        `http://127.0.0.1:${String(server.port)}/dashboard/module-files/alpha/assets/icon.svg`
      );
      expect(response.status).toBe(404);

      const telegramResponse = await fetch(
        `http://127.0.0.1:${String(server.port)}/dashboard/module-files/telegram/telegram-files/agentg-media/file.jpg`
      );
      expect(telegramResponse.status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it('closes browser WebSocket connections that send oversized payloads', async () => {
    const events = createFakeEventBus();
    const server = await startServer({
      config: testServerConfig(),
      events
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      const close = nextClose(socket);
      socket.send('x'.repeat(1_000_001));

      await expect(close).resolves.toBe(1009);
    } finally {
      socket.close();
      await server.close();
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
    staticDir: '/tmp/agentg-dashboard-test-missing',
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
