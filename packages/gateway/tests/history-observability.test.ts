import type { Server } from 'node:http';

import { procedureEnvelopeSchema } from '@agentg/shared/rpc/envelope';
import {
  historyChatHistoryStateOutputSchema,
  historyDeleteTargetInputSchema,
  historyGetChatHistoryStateInputSchema,
  historyGetOverviewInputSchema,
  historyListChatsInputSchema,
  historyListChatsOutputSchema,
  historyListJobsInputSchema,
  historyListJobsOutputSchema,
  historyOverviewOutputSchema,
  historyRequestSyncInputSchema,
  historyRequestSyncOutputSchema,
  historyRpcRouter,
  rpc,
  historyTargetMutationOutputSchema,
  historyUpsertTargetInputSchema
} from '@agentg/history-sync/rpc';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { describe, expect, it } from 'vitest';

import { createTrpcGatewayHistoryClient } from '../src/history-observability.js';

describe('createTrpcGatewayHistoryClient', () => {
  it('calls explicit History tRPC procedures for Gateway history RPC names', async () => {
    const calls: { method: string; params: unknown }[] = [];
    const server = createHTTPServer({
      router: historyRpcRouter({
        deleteTarget: rpc
          .input(historyDeleteTargetInputSchema)
          .output(procedureEnvelopeSchema(historyTargetMutationOutputSchema))
          .mutation(({ input }) => {
            calls.push({ method: 'deleteTarget', params: input });
            return { deleted: true, target: undefined, upserted: false };
          }),
        getChatHistoryState: rpc
          .input(historyGetChatHistoryStateInputSchema)
          .output(procedureEnvelopeSchema(historyChatHistoryStateOutputSchema))
          .query(({ input }) => {
            calls.push({ method: 'getChatHistoryState', params: input });
            return {
              chat: {
                historyBeginningReached: false,
                historyStartAt: null,
                id: input.chatId,
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
            };
          }),
        getOverview: rpc
          .input(historyGetOverviewInputSchema)
          .output(procedureEnvelopeSchema(historyOverviewOutputSchema))
          .query(() => {
            calls.push({ method: 'getOverview', params: undefined });
            return {
              activeJob: null,
              chats: 10,
              coverageIntervals: 30,
              pendingJobs: 1,
              runningJobs: 0,
              targets: 2,
              templates: 3
            };
          }),
        listChats: rpc
          .input(historyListChatsInputSchema)
          .output(procedureEnvelopeSchema(historyListChatsOutputSchema))
          .query(({ input }) => {
            calls.push({ method: 'listChats', params: input });
            return {
              chats: [
                {
                  coverageIntervals: 1,
                  coverageNewestAt: null,
                  coverageOldestAt: null,
                  id: input.query ?? 'chat-a',
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
                mainCount: input.list === 'main' ? 1 : 0
              },
              types: [{ count: 1, type: 'private' }]
            };
          }),
        listJobs: rpc
          .input(historyListJobsInputSchema)
          .output(procedureEnvelopeSchema(historyListJobsOutputSchema))
          .query(({ input }) => {
            calls.push({ method: 'listJobs', params: input });
            return { jobs: [] };
          }),
        requestSync: rpc
          .input(historyRequestSyncInputSchema)
          .output(procedureEnvelopeSchema(historyRequestSyncOutputSchema))
          .mutation(({ input }) => {
            calls.push({ method: 'requestSync', params: input });
            return { requested: true };
          }),
        upsertTarget: rpc
          .input(historyUpsertTargetInputSchema)
          .output(procedureEnvelopeSchema(historyTargetMutationOutputSchema))
          .mutation(({ input }) => {
            calls.push({ method: 'upsertTarget', params: input });
            return {
              deleted: false,
              target: {
                chatId: input.chatId,
                id: 'target-a',
                range: {
                  end: { expression: 'now', kind: 'expression' },
                  start: { expression: 'now-7d', kind: 'expression' }
                }
              },
              upserted: true
            };
          })
      })
    });

    const port = await listen(server);
    const client = createTrpcGatewayHistoryClient({
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

      await expect(
        client.call('history.upsertTarget', {
          chatId: 'chat-a',
          preset: 'last7d'
        })
      ).resolves.toMatchObject({
        target: {
          chatId: 'chat-a',
          id: 'target-a'
        },
        upserted: true
      });

      expect(calls).toEqual(
        expect.arrayContaining([
          { method: 'getOverview', params: undefined },
          { method: 'listChats', params: { list: 'main', query: 'chat-a' } },
          { method: 'getChatHistoryState', params: { chatId: 'chat-a' } },
          { method: 'upsertTarget', params: { chatId: 'chat-a', preset: 'last7d' } }
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
