import { Server } from '@grpc/grpc-js';
import { describe, expect, it } from 'vitest';

import {
  TelegramHistoryFetchPageKind,
  TelegramHistoryServiceService,
  type TelegramHistoryServiceServer
} from '@agentg/proto/agentg/telegram/v1/history';
import { createInsecureInternalRpcServerCredentials } from '@agentg/proto/rpc/grpc';

import { createGrpcTelegramHistoryClient } from '../../src/telegram-client.js';

describe('createGrpcTelegramHistoryClient', () => {
  it('calls Telegram History through generated gRPC client code', async () => {
    const server = new Server();
    const service: TelegramHistoryServiceServer = {
      fetchPage(call, callback) {
        callback(null, {
          anchorMessageDate: '',
          crossedStart: false,
          fetchedMessages: 2,
          kind: TelegramHistoryFetchPageKind.TELEGRAM_HISTORY_FETCH_PAGE_KIND_PAGE,
          nextCursorMessageId: '99',
          oldestFetchedMessageDate: call.request.startAt,
          reachedBeginning: false,
          storedMessages: 1
        });
      },
      listChats(call, callback) {
        callback(null, {
          chats: [
            {
              id: call.request.discover ? 'chat-discovered' : 'chat-known',
              title: 'Saved Messages',
              type: 'private'
            }
          ]
        });
      }
    };

    server.addService(TelegramHistoryServiceService, service);

    const port = await bindEphemeral(server);
    const client = createGrpcTelegramHistoryClient({
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
      await shutdown(server);
    }
  });
});

function bindEphemeral(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', createInsecureInternalRpcServerCredentials(), (error, port) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve(port);
    });
  });
}

function shutdown(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.tryShutdown((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
