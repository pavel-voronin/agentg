import type { Server } from 'node:http';

import type { EventBus, EventSubscription } from '@agentg/events/bus';
import { afterEach, describe, expect, it } from 'vitest';

import { createInMemorySummaryRepository } from '../src/memory-store.js';
import { createSummariesRpcClient } from '../src/rpc/index.js';
import { startSummariesTrpcServer, type SummariesRpcBindConfig } from '../src/rpc/server.js';
import { requestChatSummary, type SummariesRuntime } from '../src/summary-service.js';

const httpServers: Server[] = [];

describe('summaries runtime integration', () => {
  afterEach(async () => {
    await Promise.all(httpServers.splice(0).map(closeServer));
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

function serverUrl(server: Server): string {
  const address = server.address();
  if (typeof address === 'object' && address !== null) {
    return `http://127.0.0.1:${String(address.port)}`;
  }

  throw new Error('Expected TCP server address');
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
