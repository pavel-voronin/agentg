import { randomUUID } from 'node:crypto';

import type { EventBus, EventEnvelope, EventSubscription } from '@agentg/framework';
import { WebSocket, type RawData } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';

import { startGatewayServer, type GatewayServerHandle } from '../src/server.js';

const gatewayHandles: GatewayServerHandle[] = [];

describe('gateway server', () => {
  afterEach(async () => {
    await Promise.all(gatewayHandles.splice(0).map((handle) => handle.stop()));
  });

  it('exposes only telegram.getChat through WebSocket RPC', async () => {
    const calls: unknown[] = [];
    const gateway = await startGateway({
      chatLookup: {
        getChat(input) {
          calls.push(input);
          return Promise.resolve({
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
          });
        }
      }
    });
    const client = await connectGateway(gateway);

    try {
      await expect(request(client, 'telegram.getChat', { chatId: 'chat-a' })).resolves.toEqual({
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
      await expect(request(client, 'history-sync.getChatHistorySyncState', {})).rejects.toThrow(
        'Unknown method: history-sync.getChatHistorySyncState'
      );
      await expect(request(client, 'capabilities.list', {})).rejects.toThrow(
        'Unknown method: capabilities.list'
      );
      expect(calls).toEqual([{ chatId: 'chat-a' }]);
    } finally {
      client.close();
    }
  });

  it('forwards only telegram.login.completed as an external event', async () => {
    const events = createFakeEventBus();
    const gateway = await startGateway({ events });
    const client = await connectGateway(gateway);

    try {
      expect(events.subjects()).toEqual(['telegram.login.completed']);

      const ignored = createEvent('telegram.status');
      await events.emit('telegram.status', ignored);

      const event = createEvent('telegram.login.completed');
      const responsePromise = nextPayload(client);
      await events.emit('telegram.login.completed', event);

      await expect(responsePromise).resolves.toEqual({ event });
    } finally {
      client.close();
    }
  });

  it('returns dependency_unavailable for an allowed method when Telegram is absent', async () => {
    const gateway = await startGateway({
      chatLookup: {
        getChat() {
          return Promise.reject(new Error('Module is not registered: telegram'));
        }
      }
    });
    const client = await connectGateway(gateway);

    try {
      const id = `req_${randomUUID()}`;
      const responsePromise = nextResponse(client);
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
          message: 'Module is not registered: telegram'
        },
        id
      });
    } finally {
      client.close();
    }
  });

  it('requires bearer authorization when a gateway token is configured', async () => {
    const gateway = await startGateway({
      token: 'secret'
    });

    await expect(connectGateway(gateway)).rejects.toThrow('Unexpected server response: 401');
    await expect(connectGateway(gateway, { queryToken: 'secret' })).rejects.toThrow(
      'Unexpected server response: 401'
    );

    const client = await connectGateway(gateway, { token: 'secret' });
    client.close();
  });

  it('closes connections that send oversized payloads', async () => {
    const gateway = await startGateway();
    const client = await connectGateway(gateway);

    try {
      const close = nextClose(client);
      client.send('x'.repeat(1_000_001));

      await expect(close).resolves.toBe(1009);
    } finally {
      client.close();
    }
  });
});

async function startGateway(
  options: {
    chatLookup?: { getChat(input: { chatId: string }): Promise<unknown> } | undefined;
    events?: TestEventBus | undefined;
    token?: string | undefined;
  } = {}
): Promise<GatewayServerHandle> {
  const handle = await startGatewayServer({
    chatLookup: options.chatLookup ?? {
      getChat() {
        return Promise.reject(new Error('Module is not registered: telegram'));
      }
    },
    config: {
      host: '127.0.0.1',
      port: 0,
      ...(options.token === undefined ? {} : { token: options.token })
    },
    events: options.events ?? createFakeEventBus()
  });
  gatewayHandles.push(handle);
  return handle;
}

async function connectGateway(
  handle: GatewayServerHandle,
  options: { queryToken?: string | undefined; token?: string | undefined } = {}
): Promise<WebSocket> {
  const url = new URL(`ws://${handle.host}:${String(handle.port)}`);
  if (options.queryToken !== undefined) {
    url.searchParams.set('token', options.queryToken);
  }
  const client = new WebSocket(
    url,
    options.token === undefined
      ? undefined
      : {
          headers: {
            authorization: `Bearer ${options.token}`
          }
        }
  );
  await new Promise<void>((resolve, reject) => {
    client.once('open', resolve);
    client.once('error', reject);
  });

  return client;
}

async function nextClose(client: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    client.once('close', (code) => {
      resolve(code);
    });
  });
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
  emit(subject: string, event: EventEnvelope): Promise<void>;
  subjects(): string[];
};

function createFakeEventBus(): TestEventBus {
  const handlers = new Map<string, (event: EventEnvelope) => void | Promise<void>>();

  return {
    async emit(subject, event): Promise<void> {
      await handlers.get(subject)?.(event);
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

function createEvent(type: string): EventEnvelope {
  return {
    at: '2026-05-05T00:00:00.000Z',
    data: {},
    id: `evt_${randomUUID()}`,
    type
  };
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
