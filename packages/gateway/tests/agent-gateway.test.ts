import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';

import type { EventBus, EventSubscription } from '@agentg/events/bus';
import type { IntegrationEvent } from '@agentg/events/envelope';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { WebSocket, type RawData } from 'ws';
import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';

import { startAgentGatewayServer, type AgentGatewayServerHandle } from '../src/agent-gateway.js';
import { createTrpcGatewayTelegramClient } from '../src/telegram-reads.js';
import { testRpc, testRpcRouter } from './trpc-test.js';

const gatewayHandles: AgentGatewayServerHandle[] = [];
const httpServers: Server[] = [];
const telegramGetChatInputSchema = z.object({
  chatId: z.string().trim().min(1)
});

describe('Agent Gateway external surface', () => {
  afterEach(async () => {
    await Promise.all(gatewayHandles.splice(0).map((handle) => handle.close()));
    await Promise.all(httpServers.splice(0).map(close));
  });

  it('exposes only telegram.getChat through WebSocket RPC', async () => {
    const calls: unknown[] = [];
    const telegramServer = createHTTPServer({
      allowMethodOverride: true,
      router: testRpcRouter({
        getChat: testRpc.input(telegramGetChatInputSchema).query(({ input }) => {
          calls.push(input);
          return {
            chat: {
              _model: 'telegram.chat',
              avatar: {
                big: null,
                small: null
              },
              id: input.chatId,
              title: 'Alice',
              type: 'private',
              updatedAt: '2026-05-02T00:00:00.000Z'
            }
          };
        })
      })
    });
    httpServers.push(telegramServer);
    const telegramPort = await listen(telegramServer);
    const gateway = await startGateway({
      telegramUrl: `http://127.0.0.1:${String(telegramPort)}`
    });
    const client = await connectGateway(gateway);

    try {
      await expect(
        request(client, 'telegram.getChat', {
          chatId: 'chat-a'
        })
      ).resolves.toEqual({
        chat: {
          _model: 'telegram.chat',
          avatar: {
            big: null,
            small: null
          },
          id: 'chat-a',
          title: 'Alice',
          type: 'private',
          updatedAt: '2026-05-02T00:00:00.000Z'
        }
      });
      await expect(request(client, 'telegram.searchMessages', {})).rejects.toThrow(
        'Unknown method: telegram.searchMessages'
      );
      await expect(request(client, 'history.getChatStats', {})).rejects.toThrow(
        'Unknown method: history.getChatStats'
      );
      await expect(request(client, 'capabilities.list', {})).rejects.toThrow(
        'Unknown method: capabilities.list'
      );
      await expect(request(client, 'extensions.compose', {})).rejects.toThrow(
        'Unknown method: extensions.compose'
      );
      expect(calls).toEqual([{ chatId: 'chat-a' }]);
    } finally {
      client.close();
    }
  });

  it('forwards only telegram.login.completed as an external event', async () => {
    const eventBus = createFakeEventBus();
    const gateway = await startGateway({
      eventBus,
      telegramUrl: 'http://127.0.0.1:1'
    });
    const client = await connectGateway(gateway);

    try {
      expect(eventBus.subjects()).toEqual(['telegram.login.completed']);

      const event = createEvent('telegram.login.completed');
      const responsePromise = nextPayload(client);
      await eventBus.emit('telegram.login.completed', event);
      await expect(responsePromise).resolves.toEqual({
        event
      });
    } finally {
      client.close();
    }
  });

  it('returns dependency_unavailable for an allowed method when its service is absent', async () => {
    const gateway = await startAgentGatewayServer({
      config: {
        host: '127.0.0.1',
        port: 0,
        serviceUrl: 'http://127.0.0.1:0'
      },
      eventBus: createFakeEventBus(),
      telegramClient: {
        call() {
          const error = new Error('Dependency is unavailable: telegram.getChat') as Error & {
            code: string;
          };
          error.code = 'dependency_unavailable';
          throw error;
        },
        close() {
          return;
        }
      }
    });
    gatewayHandles.push(gateway);
    const client = await connectGateway(gateway);
    const id = `req_${randomUUID()}`;
    const responsePromise = nextResponse(client);

    try {
      client.send(
        JSON.stringify({
          id,
          method: 'telegram.getChat',
          params: {
            chatId: 'chat-a'
          }
        })
      );

      await expect(responsePromise).resolves.toEqual({
        error: {
          code: 'dependency_unavailable',
          message: 'Dependency is unavailable: telegram.getChat'
        },
        id
      });
    } finally {
      client.close();
    }
  });
});

async function startGateway(options: {
  eventBus?: TestEventBus | undefined;
  telegramUrl: string;
}): Promise<AgentGatewayServerHandle> {
  const handle = await startAgentGatewayServer({
    config: {
      host: '127.0.0.1',
      port: 0,
      serviceUrl: 'http://127.0.0.1:0'
    },
    eventBus: options.eventBus ?? createFakeEventBus(),
    telegramClient: createTrpcGatewayTelegramClient({
      url: options.telegramUrl
    })
  });
  gatewayHandles.push(handle);
  return handle;
}

async function connectGateway(handle: AgentGatewayServerHandle): Promise<WebSocket> {
  const client = new WebSocket(`ws://${handle.host}:${String(handle.port)}`);
  await new Promise<void>((resolve, reject) => {
    client.once('open', resolve);
    client.once('error', reject);
  });

  return client;
}

async function request(client: WebSocket, method: string, params: unknown): Promise<unknown> {
  const id = `req_${randomUUID()}`;
  const responsePromise = nextResponse(client);
  client.send(
    JSON.stringify({
      id,
      method,
      params
    })
  );
  const response = await responsePromise;
  if (response.id !== id) {
    throw new Error(`Unexpected response id: ${String(response.id)}`);
  }
  if (response.error !== undefined) {
    throw new Error(response.error.message);
  }

  return response.result;
}

async function nextResponse(client: WebSocket): Promise<GatewayResponse> {
  const payload = await nextPayload(client);
  const record = asRecord(payload);
  if (record === undefined) {
    throw new Error('Gateway response must be an object');
  }

  const id = record.id;
  if (typeof id !== 'string' && typeof id !== 'number' && id !== null) {
    throw new Error('Gateway response id must be string, number, or null');
  }

  const errorRecord = asRecord(record.error);
  const error =
    errorRecord === undefined
      ? undefined
      : {
          code: typeof errorRecord.code === 'string' ? errorRecord.code : 'unknown',
          message: typeof errorRecord.message === 'string' ? errorRecord.message : ''
        };

  return {
    ...(error === undefined ? {} : { error }),
    id,
    ...(Object.hasOwn(record, 'result') ? { result: record.result } : {})
  };
}

async function nextPayload(client: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    client.once('message', (payload) => {
      try {
        resolve(JSON.parse(rawDataToString(payload)) as unknown);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

type GatewayResponse = {
  error?: { code: string; message: string } | undefined;
  id: number | string | null;
  result?: unknown;
};

type TestEventBus = EventBus & {
  emit(subject: string, event: IntegrationEvent): Promise<void>;
  subjects(): string[];
};

function createFakeEventBus(): TestEventBus {
  const handlers = new Map<string, (event: IntegrationEvent) => void | Promise<void>>();

  return {
    close(): Promise<void> {
      return Promise.resolve();
    },
    async emit(subject, event): Promise<void> {
      await handlers.get(subject)?.(event);
    },
    publish(): void {
      return;
    },
    subscribe(subject, handler): EventSubscription {
      handlers.set(subject, handler);
      return {
        unsubscribe(): void {
          handlers.delete(subject);
        }
      };
    },
    subjects(): string[] {
      return [...handlers.keys()];
    }
  };
}

function createEvent(type: string): IntegrationEvent {
  return {
    data: {},
    id: `evt_${randomUUID()}`,
    occurredAt: '2026-05-05T00:00:00.000Z',
    type
  };
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        resolve(address.port);
        return;
      }

      throw new Error('Expected TCP server address');
    });
  });
}

function close(server: Server): Promise<void> {
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

function rawDataToString(payload: RawData): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if (Buffer.isBuffer(payload)) {
    return payload.toString('utf8');
  }

  if (Array.isArray(payload)) {
    return Buffer.concat(payload).toString('utf8');
  }

  return Buffer.from(payload).toString('utf8');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
