import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';

import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import { procedureEnvelopeSchema } from '@agentg/shared/rpc/envelope';
import { historyRpcRouter, rpc } from '@agentg/history-sync/rpc';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { WebSocket, type RawData } from 'ws';
import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';

import { startAgentGatewayServer, type AgentGatewayServerHandle } from '../src/agent-gateway.js';

const gatewayHandles: AgentGatewayServerHandle[] = [];
const httpServers: Server[] = [];

describe('Agent Gateway capabilities', () => {
  afterEach(async () => {
    await Promise.all(gatewayHandles.splice(0).map((handle) => handle.close()));
    await Promise.all(httpServers.splice(0).map(close));
  });

  it('registers, refreshes, lists, and removes stale capabilities', async () => {
    const gateway = await startGateway({
      capabilityRegistrationTtlMs: 20
    });
    const client = await connectGateway(gateway);

    try {
      await expect(
        request(client, 'capabilities.register', {
          moduleSlug: 'modulesmoke',
          name: 'modulesmoke.echo',
          rpcMethod: 'echo',
          rpcType: 'query',
          serviceUrl: 'http://modulesmoke:8080'
        })
      ).resolves.toMatchObject({
        moduleSlug: 'modulesmoke',
        name: 'modulesmoke.echo',
        refreshed: false,
        registered: true
      });

      await expect(
        request(client, 'capabilities.register', {
          moduleSlug: 'modulesmoke',
          name: 'modulesmoke.echo',
          rpcMethod: 'echo',
          rpcType: 'query',
          serviceUrl: 'http://modulesmoke:8080'
        })
      ).resolves.toMatchObject({
        refreshed: true,
        registered: false
      });

      await expect(request(client, 'capabilities.list', undefined)).resolves.toMatchObject({
        capabilities: [
          {
            moduleSlug: 'modulesmoke',
            name: 'modulesmoke.echo',
            rpcMethod: 'echo',
            rpcType: 'query',
            serviceUrl: 'http://modulesmoke:8080'
          }
        ]
      });

      await delay(40);

      await expect(request(client, 'capabilities.list', undefined)).resolves.toEqual({
        capabilities: []
      });
    } finally {
      client.close();
    }
  });

  it('proxies capability calls to the owning module tRPC method', async () => {
    const calls: unknown[] = [];
    const moduleServer = createHTTPServer({
      router: historyRpcRouter({
        summarizeChat: rpc
          .input(z.object({ chatId: z.string() }))
          .output(procedureEnvelopeSchema(z.object({ summary: z.string() })))
          .query(({ input }) => {
            calls.push(input);
            return {
              summary: `summary:${input.chatId}`
            };
          })
      })
    });
    httpServers.push(moduleServer);
    const modulePort = await listen(moduleServer);
    const gateway = await startGateway();
    const client = await connectGateway(gateway);

    try {
      await request(client, 'capabilities.register', {
        moduleSlug: 'summaries',
        name: 'summaries.summarizeChat',
        rpcMethod: 'summarizeChat',
        rpcType: 'query',
        serviceUrl: `http://127.0.0.1:${String(modulePort)}`
      });

      await expect(
        request(client, 'capabilities.call', {
          input: {
            chatId: 'chat-a'
          },
          name: 'summaries.summarizeChat'
        })
      ).resolves.toEqual({
        summary: 'summary:chat-a'
      });

      expect(calls).toEqual([{ chatId: 'chat-a' }]);
    } finally {
      client.close();
    }
  });
});

async function startGateway(
  options: {
    capabilityRegistrationTtlMs?: number;
  } = {}
): Promise<AgentGatewayServerHandle> {
  const handle = await startAgentGatewayServer({
    ...options,
    config: {
      host: '127.0.0.1',
      port: 0
    },
    eventBus: createFakeEventBus(),
    services: {
      history: {
        url: 'http://127.0.0.1:1'
      },
      telegram: {
        url: 'http://127.0.0.1:1'
      }
    }
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
  return new Promise((resolve, reject) => {
    client.once('message', (payload) => {
      try {
        resolve(parseGatewayResponse(payload));
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

function parseGatewayResponse(payload: RawData): GatewayResponse {
  const parsed = JSON.parse(rawDataToString(payload)) as unknown;
  const record = asRecord(parsed);
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

function createFakeEventBus(): EventBus {
  return {
    close(): Promise<void> {
      return Promise.resolve();
    },
    publish(): void {
      return;
    },
    subscribe(): EventSubscription {
      return {
        unsubscribe(): void {
          return;
        }
      };
    }
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

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
