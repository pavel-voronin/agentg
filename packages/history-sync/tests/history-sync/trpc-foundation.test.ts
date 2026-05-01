import type { Server } from 'node:http';

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  createHistoryRpcContext,
  historyRpcProcedure,
  historyRpcRouter,
  INTERNAL_RPC_CORRELATION_ID_HEADER
} from '../../src/rpc/trpc.js';

describe('History tRPC foundation', () => {
  it('performs a package-local tRPC client/server round trip', async () => {
    const testRouter = historyRpcRouter({
      echo: historyRpcProcedure
        .input(z.object({ value: z.string() }))
        .output(z.object({ correlationId: z.string().optional(), value: z.string() }))
        .query(({ ctx, input }) => ({
          ...(ctx.correlationId === undefined ? {} : { correlationId: ctx.correlationId }),
          value: input.value
        }))
    });
    const server = createHTTPServer({
      createContext: createHistoryRpcContext,
      router: testRouter
    });
    const port = await listenEphemeral(server);
    const client = createTRPCClient<typeof testRouter>({
      links: [
        httpBatchLink({
          headers: {
            [INTERNAL_RPC_CORRELATION_ID_HEADER]: 'history-stage-1'
          },
          url: `http://127.0.0.1:${String(port)}`
        })
      ]
    });

    try {
      await expect(client.echo.query({ value: 'history' })).resolves.toEqual({
        correlationId: 'history-stage-1',
        value: 'history'
      });
    } finally {
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
