import type { Server } from 'node:http';

import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createTrpcGatewayHistoryClient } from '../src/history-observability.js';
import { testRpc, testRpcRouter } from './trpc-test.js';

const nonEmptyStringSchema = z.string().trim().min(1);
const historyDeleteTargetInputSchema = z.object({
  targetId: nonEmptyStringSchema
});
const historyGetChatHistoryStateInputSchema = z.object({
  chatId: nonEmptyStringSchema
});
const historyGetChatStatsInputSchema = z.object({
  chatIds: z.array(nonEmptyStringSchema)
});
const historyListJobsInputSchema = z
  .object({
    limit: z.number().int().positive().optional(),
    status: nonEmptyStringSchema.optional()
  })
  .default({});
const historyRequestSyncInputSchema = z
  .object({
    chatId: nonEmptyStringSchema.optional()
  })
  .default({});
const historyUpsertTargetInputSchema = z
  .object({
    chatId: nonEmptyStringSchema,
    end: nonEmptyStringSchema.optional(),
    preset: nonEmptyStringSchema.optional(),
    start: nonEmptyStringSchema.optional(),
    targetId: nonEmptyStringSchema.optional()
  })
  .loose();

describe('createTrpcGatewayHistoryClient', () => {
  it('calls explicit History tRPC procedures for Gateway history RPC names', async () => {
    const calls: { method: string; params: unknown }[] = [];
    const server = createHTTPServer({
      router: testRpcRouter({
        deleteTarget: testRpc.input(historyDeleteTargetInputSchema).mutation(({ input }) => {
          calls.push({ method: 'deleteTarget', params: input });
          return { deleted: true, target: undefined, upserted: false };
        }),
        getChatHistoryState: testRpc
          .input(historyGetChatHistoryStateInputSchema)
          .query(({ input }) => {
            calls.push({ method: 'getChatHistoryState', params: input });
            return {
              chat: {
                _model: 'telegram.chat',
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
        getChatStats: testRpc.input(historyGetChatStatsInputSchema).query(({ input }) => {
          calls.push({ method: 'getChatStats', params: input });
          return {
            stats: input.chatIds.map((chatId) => ({
              chatId,
              coverageIntervals: 1,
              coverageNewestAt: null,
              coverageOldestAt: null,
              pendingJobs: 0,
              runningJobs: 0,
              targets: 1
            }))
          };
        }),
        getOverview: testRpc.query(() => {
          calls.push({ method: 'getOverview', params: undefined });
          return {
            activeJob: null,
            coverageIntervals: 30,
            pendingJobs: 1,
            runningJobs: 0,
            targets: 2,
            templates: 3
          };
        }),
        listJobs: testRpc.input(historyListJobsInputSchema).query(({ input }) => {
          calls.push({ method: 'listJobs', params: input });
          return { jobs: [] };
        }),
        requestSync: testRpc.input(historyRequestSyncInputSchema).mutation(({ input }) => {
          calls.push({ method: 'requestSync', params: input });
          return { requested: true };
        }),
        upsertTarget: testRpc.input(historyUpsertTargetInputSchema).mutation(({ input }) => {
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
        coverageIntervals: 30,
        pendingJobs: 1,
        targets: 2,
        templates: 3
      });

      await expect(
        client.call('history.getChatStats', {
          chatIds: ['chat-a']
        })
      ).resolves.toEqual({
        stats: [
          {
            chatId: 'chat-a',
            coverageIntervals: 1,
            coverageNewestAt: null,
            coverageOldestAt: null,
            pendingJobs: 0,
            runningJobs: 0,
            targets: 1
          }
        ]
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
          { method: 'getChatStats', params: { chatIds: ['chat-a'] } },
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
