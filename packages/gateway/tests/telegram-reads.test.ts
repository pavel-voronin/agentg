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
const telegramGetMessageInputSchema = z.object({
  chatId: nonEmptyStringSchema,
  messageId: nonEmptyStringSchema
});
const telegramListRecentMessagesInputSchema = z
  .object({
    chatId: nonEmptyStringSchema.optional(),
    limit: z.number().int().positive().optional()
  })
  .default({});
const telegramSearchMessagesInputSchema = z.object({
  chatId: nonEmptyStringSchema.optional(),
  limit: z.number().int().positive().optional(),
  query: nonEmptyStringSchema
});

describe('createTrpcGatewayTelegramClient', () => {
  it('calls Telegram-owned read procedures for Gateway telegram RPC names', async () => {
    const calls: { method: string; params: unknown }[] = [];
    const message = {
      chatId: 'chat-a',
      contentType: 'messageText',
      deletedAt: null,
      editDate: null,
      isDeleted: false,
      messageDate: '2026-05-01T00:00:00.000Z',
      messageId: '42',
      senderId: 'user-a',
      senderType: 'messageSenderUser',
      text: 'hello',
      updatedAt: '2026-05-01T00:00:01.000Z'
    };
    const server = createHTTPServer({
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
        }),
        getMessage: testRpc.input(telegramGetMessageInputSchema).query(({ input }) => {
          calls.push({ method: 'getMessage', params: input });
          return {
            message
          };
        }),
        listRecentMessages: testRpc
          .input(telegramListRecentMessagesInputSchema)
          .query(({ input }) => {
            calls.push({ method: 'listRecentMessages', params: input });
            return {
              messages: [message]
            };
          }),
        searchMessages: testRpc.input(telegramSearchMessagesInputSchema).query(({ input }) => {
          calls.push({ method: 'searchMessages', params: input });
          return {
            messages: [message]
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

      await expect(
        client.call('telegram.listRecentMessages', {
          chatId: 'chat-a',
          limit: 10
        })
      ).resolves.toEqual({
        messages: [message]
      });

      expect(
        JSON.stringify(
          await client.call('telegram.getMessage', {
            chatId: 'chat-a',
            messageId: '42'
          })
        )
      ).not.toContain('"raw"');

      expect(calls).toEqual(
        expect.arrayContaining([
          { method: 'getChat', params: { chatId: 'chat-a' } },
          { method: 'getMessage', params: { chatId: 'chat-a', messageId: '42' } },
          { method: 'listRecentMessages', params: { chatId: 'chat-a', limit: 10 } }
        ])
      );
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
