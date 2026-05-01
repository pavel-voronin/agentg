import type { Server } from 'node:http';

import {
  telegramHistoryChatSchema,
  telegramHistoryFetchPageInputSchema,
  telegramHistoryFetchPageResultSchema,
  telegramHistoryListChatsInputSchema,
  telegramRpcProcedure,
  telegramRpcRouter
} from '@agentg/telegram/rpc';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createTrpcTelegramHistoryClient } from '../../src/telegram-client.js';

describe('createTrpcTelegramHistoryClient', () => {
  it('calls Telegram History through the domain-owned tRPC router shape', async () => {
    const router = telegramRpcRouter({
      fetchPage: telegramRpcProcedure
        .input(telegramHistoryFetchPageInputSchema)
        .output(telegramHistoryFetchPageResultSchema)
        .mutation(({ input }) => ({
          crossedStart: false,
          fetchedMessages: 2,
          kind: 'page',
          nextCursorMessageId: 99,
          oldestFetchedMessageDate: input.startAt,
          reachedBeginning: false,
          storedMessages: 1
        })),
      listChats: telegramRpcProcedure
        .input(telegramHistoryListChatsInputSchema)
        .output(z.array(telegramHistoryChatSchema))
        .query(({ input }) => [
          {
            id: input.discover === true ? 'chat-discovered' : 'chat-known',
            title: 'Saved Messages',
            type: 'private'
          }
        ])
    });
    const server = createHTTPServer({ router });
    const port = await listenEphemeral(server);
    const client = createTrpcTelegramHistoryClient({
      url: `http://127.0.0.1:${String(port)}`
    });

    try {
      await expect(client.listChats({ discover: true })).resolves.toEqual([
        {
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
