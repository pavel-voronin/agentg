import type { Server } from 'node:http';

import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createTrpcGatewayTelegramClient } from '../src/telegram-reads.js';
import { testRpc, testRpcRouter } from './trpc-test.js';

const nonEmptyStringSchema = z.string().trim().min(1);
const telegramGetChatInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

describe('createTrpcGatewayTelegramClient', () => {
  it('calls only Telegram getChat for the Gateway telegram RPC surface', async () => {
    const calls: { method: string; params: unknown }[] = [];
    const server = createHTTPServer({
      allowMethodOverride: true,
      router: testRpcRouter({
        getChat: testRpc.input(telegramGetChatInputSchema).query(({ input }) => {
          calls.push({ method: 'getChat', params: input });
          return {
            chat: {
              _model: 'telegram.chat',
              id: input.chatId,
              title: 'Saved Messages',
              type: 'private',
              updatedAt: '2026-05-01T00:00:00.000Z'
            }
          };
        })
      })
    });
    const port = await listen(server);
    const client = createTrpcGatewayTelegramClient({
      url: `http://127.0.0.1:${String(port)}`
    });

    try {
      await expect(client.call('telegram.getChat', { chatId: 'chat-a' })).resolves.toEqual({
        chat: {
          _model: 'telegram.chat',
          id: 'chat-a',
          title: 'Saved Messages',
          type: 'private',
          updatedAt: '2026-05-01T00:00:00.000Z'
        }
      });
      await expect(client.call('telegram.searchMessages', {})).resolves.toBeUndefined();
      expect(calls).toEqual([{ method: 'getChat', params: { chatId: 'chat-a' } }]);
    } finally {
      client.close();
      await close(server);
    }
  });
});

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
