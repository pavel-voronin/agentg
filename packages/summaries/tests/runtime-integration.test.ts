import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';

import { createCapabilityRegistry, type CapabilityRegistry } from '@agentg/shared/rpc/capabilities';
import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import {
  startAgentGatewayServer,
  type AgentGatewayServerHandle
} from '@agentg/gateway/src/agent-gateway.js';
import { WebSocket, type RawData } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';

import { createInMemorySummaryRepository } from '../src/memory-store.js';
import { registerSummariesCapabilities } from '../src/registrations.js';
import { createSummariesRpcClient } from '../src/rpc/index.js';
import { startSummariesTrpcServer, type SummariesRpcBindConfig } from '../src/rpc/server.js';
import { requestChatSummary, type SummariesRuntime } from '../src/summary-service.js';

const gatewayHandles: AgentGatewayServerHandle[] = [];
const httpServers: Server[] = [];

describe('summaries runtime integration', () => {
  afterEach(async () => {
    await Promise.all(gatewayHandles.splice(0).map((handle) => handle.close()));
    await Promise.all(httpServers.splice(0).map(closeServer));
  });

  it('registers a Gateway capability and serves it through the summaries RPC owner', async () => {
    const eventBus = createFakeEventBus();
    const runtime = createTestRuntime(eventBus);
    const summariesServer = await startSummariesHttp(runtime, eventBus);
    const summariesUrl = serverUrl(summariesServer);
    const capabilityRegistry = createCapabilityRegistry({ ttlMs: 60_000 });
    const gateway = await startGateway(capabilityRegistry);
    const gatewayUrl = `ws://${gateway.host}:${String(gateway.port)}`;

    await registerSummariesCapabilities(
      {
        capabilities: [
          {
            moduleSlug: 'summaries',
            name: 'summaries.requestChatSummary',
            rpcMethod: 'summaries.requestSummary',
            rpcType: 'mutation',
            serviceUrl: summariesUrl
          }
        ],
        databaseUrl: 'postgres://agentg:agentg@localhost:5432/agentg',
        extensionRegistrations: [],
        gatewayRpcUrl: gatewayUrl,
        migrationFolder: 'packages/summaries/drizzle',
        natsUrl: 'nats://localhost:4222',
        serviceRpcUrl: summariesUrl,
        slug: 'summaries',
        tablePrefix: 'summaries_'
      },
      gatewayUrl
    );

    const client = await connectGateway(gateway);
    try {
      await expect(request(client, 'capabilities.list', undefined)).resolves.toMatchObject({
        capabilities: [
          {
            moduleSlug: 'summaries',
            name: 'summaries.requestChatSummary',
            rpcMethod: 'summaries.requestSummary',
            rpcType: 'mutation',
            serviceUrl: summariesUrl
          }
        ]
      });

      await expect(
        request(client, 'capabilities.call', {
          input: {
            chatId: 'chat-a',
            reason: 'agent-request'
          },
          name: 'summaries.requestChatSummary'
        })
      ).resolves.toMatchObject({
        run: {
          chatId: 'chat-a',
          status: 'completed'
        },
        summary: {
          chatId: 'chat-a'
        }
      });
    } finally {
      client.close();
    }
  });

  it('serves summaries.chatSummary as a telegram.chat getter', async () => {
    const eventBus = createFakeEventBus();
    const runtime = createTestRuntime(eventBus);
    const summariesServer = await startSummariesHttp(runtime, eventBus);
    const summariesUrl = serverUrl(summariesServer);

    await requestChatSummary(runtime, {
      chatId: 'chat-a',
      reason: 'test',
      sourceMessages: []
    });

    const client = createSummariesRpcClient({
      url: summariesUrl
    });

    try {
      await expect(
        client.chatSummary({
          _model: 'telegram.chat',
          id: 'chat-a',
          title: 'Alice',
          type: 'private'
        })
      ).resolves.toMatchObject({
        stale: false,
        summary: {
          chatId: 'chat-a'
        }
      });
    } finally {
      client.close();
    }
  });
});

function createTestRuntime(eventBus: EventBus): SummariesRuntime {
  return {
    eventBus,
    now: () => new Date('2026-05-02T00:00:00.000Z'),
    repository: createInMemorySummaryRepository()
  };
}

async function startSummariesHttp(runtime: SummariesRuntime, eventBus: EventBus): Promise<Server> {
  const bind: SummariesRpcBindConfig = {
    host: '127.0.0.1',
    port: 0
  };
  const server = await startSummariesTrpcServer({
    bind,
    eventBus,
    runtime
  });
  httpServers.push(server);
  return server;
}

async function startGateway(
  capabilityRegistry: CapabilityRegistry
): Promise<AgentGatewayServerHandle> {
  const handle = await startAgentGatewayServer({
    capabilityRegistry,
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

function serverUrl(server: Server): string {
  const address = server.address();
  if (typeof address === 'object' && address !== null) {
    return `http://127.0.0.1:${String(address.port)}`;
  }

  throw new Error('Expected TCP server address');
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

function closeServer(server: Server): Promise<void> {
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
