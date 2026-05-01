import { Server } from '@grpc/grpc-js';
import { describe, expect, it } from 'vitest';

import {
  HistoryChatListKind,
  HistoryServiceService,
  type HistoryServiceServer
} from '@agentg/proto/agentg/history/v1/history';
import { createInsecureInternalRpcServerCredentials } from '@agentg/proto/rpc/grpc';

import { createGrpcGatewayHistoryClient } from '../src/history-observability.js';

describe('createGrpcGatewayHistoryClient', () => {
  it('calls explicit History gRPC methods for Gateway history RPC names', async () => {
    const server = new Server();
    const service: HistoryServiceServer = {
      deleteTarget(_call, callback) {
        callback(null, { deleted: true, target: undefined, upserted: false });
      },
      getChatHistoryState(call, callback) {
        callback(null, {
          chat: {
            historyBeginningReached: false,
            historyStartAt: '',
            id: call.request.chatId,
            isBot: false,
            messageCount: 3,
            title: 'Saved Messages',
            type: 'private',
            updatedAt: '2026-04-30T00:00:00.000Z'
          },
          coverage: [],
          desired: [],
          jobs: [],
          missing: [],
          targets: []
        });
      },
      getOverview(_call, callback) {
        callback(null, {
          activeJob: undefined,
          chats: 10,
          coverageIntervals: 30,
          pendingJobs: 1,
          runningJobs: 0,
          targets: 2,
          templates: 3
        });
      },
      listChats(call, callback) {
        callback(null, {
          chats: [
            {
              coverageIntervals: 1,
              coverageNewestAt: '',
              coverageOldestAt: '',
              id: call.request.query,
              isBot: false,
              pendingJobs: 0,
              runningJobs: 0,
              targets: 1,
              title: 'Alice',
              type: 'private',
              updatedAt: '2026-04-30T00:00:00.000Z'
            }
          ],
          navigation: {
            archiveCount: 0,
            folders: [],
            mainCount: call.request.list === HistoryChatListKind.HISTORY_CHAT_LIST_KIND_MAIN ? 1 : 0
          },
          types: [{ count: 1, type: 'private' }]
        });
      },
      listJobs(_call, callback) {
        callback(null, { jobs: [] });
      },
      requestSync(_call, callback) {
        callback(null, { requested: true });
      },
      upsertTarget(_call, callback) {
        callback(null, { deleted: false, target: undefined, upserted: true });
      }
    };

    server.addService(HistoryServiceService, service);

    const port = await bindEphemeral(server);
    const client = createGrpcGatewayHistoryClient({
      url: `http://127.0.0.1:${String(port)}`
    });

    try {
      await expect(client.call('history.getOverview', undefined)).resolves.toMatchObject({
        chats: 10,
        coverageIntervals: 30,
        pendingJobs: 1,
        targets: 2,
        templates: 3
      });

      await expect(
        client.call('history.listChats', {
          list: 'main',
          query: 'chat-a'
        })
      ).resolves.toMatchObject({
        chats: [
          {
            id: 'chat-a',
            title: 'Alice',
            type: 'private'
          }
        ],
        navigation: {
          mainCount: 1
        }
      });

      await expect(
        client.call('history.getChatHistoryState', {
          chatId: 'chat-a'
        })
      ).resolves.toMatchObject({
        chat: {
          id: 'chat-a',
          messageCount: 3,
          title: 'Saved Messages'
        }
      });
    } finally {
      client.close();
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
