import type { EventBus, EventSubscription } from '@agentg/events/bus';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/events/envelope';
import { WebSocket, type RawData } from 'ws';
import { describe, expect, it, vi } from 'vitest';

import { startControlPlaneServer } from '../src/server/control-plane-server.js';

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
      config: {
        host: '127.0.0.1',
        port: 0,
        serviceUrl: 'http://127.0.0.1:0',
        staticDir: '/tmp/agentg-control-plane-test-missing'
      },
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
        source: 'test',
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
        source: 'beta-service',
        type: 'rpc.beta.getStatus.started'
      });
      await eventBus.emit(rpcEvent);

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        event: rpcEvent
      });

      const summariesEvent = createIntegrationEvent({
        data: {
          recordId: 'record-a',
          runId: 'run-a'
        },
        source: 'summaries',
        type: 'summaries.summary.requested'
      });
      await eventBus.emit(summariesEvent);

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        event: summariesEvent
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
      config: {
        host: '127.0.0.1',
        port: 0,
        serviceUrl: 'http://127.0.0.1:0',
        staticDir: '/tmp/agentg-control-plane-test-missing'
      },
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
      config: {
        host: '127.0.0.1',
        port: 0,
        serviceUrl: 'http://127.0.0.1:0',
        staticDir: '/tmp/agentg-control-plane-test-missing'
      },
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
      const runtimeResponse = await fetch(
        `http://127.0.0.1:${String(server.port)}/control-plane/runtime/vue.js`
      );
      expect(runtimeResponse.status).toBe(200);
      await expect(runtimeResponse.text()).resolves.toContain('vue');
    } finally {
      await server.close();
    }
  });
});

type FakeEventBus = EventBus & {
  emit(event: IntegrationEvent): Promise<void>;
};

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
