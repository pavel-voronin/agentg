import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/shared/events/envelope';
import { WebSocket, type RawData } from 'ws';
import { describe, expect, it, vi } from 'vitest';

import { startControlPlaneServer } from '../src/server/control-plane-server.js';

describe('Control Plane server boundary', () => {
  it('routes browser history RPC to the History client and forwards events', async () => {
    const eventBus = createFakeEventBus();
    const historyClient = {
      call: vi.fn((method: string, params: unknown): Promise<unknown> => {
        if (method === 'history.getOverview') {
          return Promise.resolve({
            chats: 3,
            coverageIntervals: 5,
            params
          });
        }
        return Promise.resolve(undefined);
      }),
      close: vi.fn()
    };

    const server = await startControlPlaneServer({
      config: {
        host: '127.0.0.1',
        port: 0,
        staticDir: '/tmp/agentg-control-plane-test-missing'
      },
      eventBus,
      historyClient,
      services: {
        history: {
          url: 'http://127.0.0.1:1'
        }
      }
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      socket.send(JSON.stringify({ id: 1, method: 'history.getOverview', params: {} }));

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        id: 1,
        result: {
          chats: 3,
          coverageIntervals: 5,
          params: {}
        }
      });
      expect(historyClient.call).toHaveBeenCalledWith('history.getOverview', {});

      const event = createIntegrationEvent({
        data: {
          chatId: 'chat-a'
        },
        source: 'test',
        type: 'history.coverage.changed'
      });
      await eventBus.emit(event);

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        event
      });
    } finally {
      socket.close();
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
