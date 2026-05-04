import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/shared/events/envelope';
import { WebSocket, type RawData } from 'ws';
import { describe, expect, it, vi } from 'vitest';

import { startControlPlaneServer } from '../src/server/control-plane-server.js';

describe('Control Plane server boundary', () => {
  it('routes browser history RPC to the History client and forwards events', async () => {
    const eventBus = createFakeEventBus();
    const historyClient = {
      close: vi.fn(),
      deleteTarget: vi.fn(),
      getChatHistoryState: vi.fn(),
      getChatStats: vi.fn(),
      getOverview: vi.fn(() =>
        Promise.resolve({
          chats: 3,
          coverageIntervals: 5
        })
      ),
      listJobs: vi.fn(),
      requestSync: vi.fn(),
      upsertTarget: vi.fn()
    };
    const telegramClient = {
      close: vi.fn(),
      listChatDirectory: vi.fn()
    };

    const server = await startControlPlaneServer({
      config: {
        host: '127.0.0.1',
        port: 0,
        staticDir: '/tmp/agentg-control-plane-test-missing'
      },
      eventBus,
      historyClient,
      telegramClient,
      services: {
        history: {
          url: 'http://127.0.0.1:1'
        },
        telegram: {
          url: 'http://127.0.0.1:2'
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
          coverageIntervals: 5
        }
      });
      expect(historyClient.getOverview).toHaveBeenCalledWith();

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

      const rpcEvent = createIntegrationEvent({
        data: {
          callId: 'call-a',
          target: 'history.getOverview'
        },
        source: 'history-sync',
        type: 'history.getOverview.started'
      });
      await eventBus.emit(rpcEvent);

      await expect(nextJsonMessage(socket)).resolves.toEqual({
        event: rpcEvent
      });

      const summariesEvent = createIntegrationEvent({
        data: {
          chatId: 'chat-a',
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

  it('builds Control Plane chat lists from Telegram directory and History stats', async () => {
    const eventBus = createFakeEventBus();
    const historyClient = {
      close: vi.fn(),
      deleteTarget: vi.fn(),
      getChatHistoryState: vi.fn(),
      getChatStats: vi.fn(() =>
        Promise.resolve({
          stats: [
            {
              chatId: 'chat-b',
              coverageIntervals: 2,
              coverageNewestAt: '2026-05-01T01:00:00.000Z',
              coverageOldestAt: '2026-05-01T00:00:00.000Z',
              pendingJobs: 1,
              runningJobs: 0,
              targets: 3
            }
          ]
        })
      ),
      getOverview: vi.fn(),
      listJobs: vi.fn(),
      requestSync: vi.fn(),
      upsertTarget: vi.fn()
    };
    const mainChat = {
      _model: 'telegram.chat' as const,
      id: 'chat-b',
      isBot: false,
      isSelf: false,
      lastMessageDate: 20,
      placements: [{ kind: 'main' as const, order: '200' }],
      title: 'Beta',
      type: 'private',
      updatedAt: '2026-05-01T01:00:00.000Z'
    };
    const archiveChat = {
      _model: 'telegram.chat' as const,
      id: 'chat-a',
      isBot: false,
      isSelf: false,
      lastMessageDate: 10,
      placements: [{ kind: 'archive' as const, order: '100' }],
      title: 'Alpha',
      type: 'basic_group',
      updatedAt: '2026-05-01T00:00:00.000Z'
    };
    const telegramClient = {
      close: vi.fn(),
      listChatDirectory: vi.fn(() =>
        Promise.resolve({
          chats: [mainChat, archiveChat],
          folders: [],
          navigationChats: [mainChat, archiveChat],
          types: [{ count: 1, type: 'private' }]
        })
      )
    };

    const server = await startControlPlaneServer({
      config: {
        host: '127.0.0.1',
        port: 0,
        staticDir: '/tmp/agentg-control-plane-test-missing'
      },
      eventBus,
      historyClient,
      telegramClient,
      services: {
        history: {
          url: 'http://127.0.0.1:1'
        },
        telegram: {
          url: 'http://127.0.0.1:2'
        }
      }
    });
    const socket = await openWebSocket(`ws://127.0.0.1:${String(server.port)}/ws`);

    try {
      socket.send(
        JSON.stringify({ id: 2, method: 'controlPlane.listChats', params: { list: 'main' } })
      );

      await expect(nextJsonMessage(socket)).resolves.toMatchObject({
        id: 2,
        result: {
          chats: [
            {
              coverageIntervals: 2,
              id: 'chat-b',
              pendingJobs: 1,
              runningJobs: 0,
              targets: 3,
              title: 'Beta',
              type: 'private'
            }
          ],
          navigation: {
            archiveCount: 1,
            mainCount: 1
          },
          types: [{ count: 1, type: 'private' }]
        }
      });
      expect(telegramClient.listChatDirectory).toHaveBeenCalledWith({});
      expect(historyClient.getChatStats).toHaveBeenCalledWith({
        chatIds: ['chat-b']
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
