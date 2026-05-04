import type { Server } from 'node:http';

import {
  telegramGetChatInputSchema,
  telegramGetChatOutputSchema,
  telegramGetMessageInputSchema,
  telegramGetMessageOutputSchema,
  telegramListRecentMessagesInputSchema,
  telegramListRecentMessagesOutputSchema,
  telegramRpcRouter,
  rpc,
  telegramSearchMessagesInputSchema,
  telegramSearchMessagesOutputSchema
} from '@agentg/telegram/rpc';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { describe, expect, it } from 'vitest';

import { createTrpcGatewayTelegramClient } from '../src/telegram-reads.js';

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
      router: telegramRpcRouter({
        getChat: rpc
          .input(telegramGetChatInputSchema)
          .output(telegramGetChatOutputSchema)
          .query(({ input }) => {
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
        getMessage: rpc
          .input(telegramGetMessageInputSchema)
          .output(telegramGetMessageOutputSchema)
          .query(({ input }) => {
            calls.push({ method: 'getMessage', params: input });
            return {
              message
            };
          }),
        listRecentMessages: rpc
          .input(telegramListRecentMessagesInputSchema)
          .output(telegramListRecentMessagesOutputSchema)
          .query(({ input }) => {
            calls.push({ method: 'listRecentMessages', params: input });
            return {
              messages: [message]
            };
          }),
        searchMessages: rpc
          .input(telegramSearchMessagesInputSchema)
          .output(telegramSearchMessagesOutputSchema)
          .query(({ input }) => {
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
