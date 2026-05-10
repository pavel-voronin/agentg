import type { Server } from 'node:http';

import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createTrpcTelegramHistoryClient } from '../../src/telegram-client.js';
import { testRpc, testRpcRouter } from '../trpc-test.js';

const telegramFetchPageInputSchema = z.object({
  chatId: z.string().min(1),
  cursorMessageId: z.number().int().optional(),
  endAt: z.string().min(1),
  limit: z.number().int().positive(),
  startAt: z.string().min(1)
});
const telegramListChatsInputSchema = z.object({
  discover: z.boolean().optional(),
  loadBatchSize: z.number().int().positive().optional()
});

describe('createTrpcTelegramHistoryClient', () => {
  it('calls Telegram history RPC through the domain-owned client', async () => {
    const router = testRpcRouter({
      fetchPage: testRpc.input(telegramFetchPageInputSchema).mutation(({ input }) => ({
        crossedStart: false,
        fetchedMessages: 2,
        kind: 'page',
        nextCursorMessageId: 99,
        oldestFetchedMessageDate: input.startAt,
        reachedBeginning: false,
        storedMessages: 1
      })),
      listChats: testRpc.input(telegramListChatsInputSchema).query(({ input }) => [
        {
          _model: 'telegram.chat',
          id: input.discover === true ? 'chat-discovered' : 'chat-known',
          title: 'Saved Messages',
          type: 'private'
        }
      ])
    });
    const server = createHTTPServer({
      allowMethodOverride: true,
      router
    });
    const port = await listenEphemeral(server);
    const client = createTrpcTelegramHistoryClient({
      url: `http://127.0.0.1:${String(port)}`
    });

    try {
      await expect(client.listChats({ discover: true })).resolves.toEqual([
        {
          _model: 'telegram.chat',
          id: 'chat-discovered',
          title: 'Saved Messages',
          type: 'private'
        }
      ]);

      await expect(
        client.fetchPage({
          chatId: '123',
          endAt: '2026-04-02T00:00:00.000Z',
          limit: 100,
          startAt: '2026-04-01T00:00:00.000Z'
        })
      ).resolves.toEqual({
        crossedStart: false,
        fetchedMessages: 2,
        kind: 'page',
        nextCursorMessageId: 99,
        oldestFetchedMessageDate: '2026-04-01T00:00:00.000Z',
        reachedBeginning: false,
        storedMessages: 1
      });
    } finally {
      client.close?.();
      await closeServer(server);
    }
  });
});

function listenEphemeral(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        resolve(address.port);
        return;
      }

      throw new Error('tRPC test server did not expose a TCP port');
    });
  });
}

function closeServer(server: Server): Promise<void> {
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
