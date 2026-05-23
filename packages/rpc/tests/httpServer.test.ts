import type { Server } from 'node:http';

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createInternalTrpcHttpServer } from '../src/httpServer.js';
import { rpc } from './trpcTest.js';

describe('internal tRPC HTTP server', () => {
  it('accepts POST query requests with large inputs', async () => {
    const router = rpc.router({
      size: rpc.procedure.input(z.object({ value: z.string() })).query(({ input }) => ({
        length: input.value.length
      }))
    });
    const server = createInternalTrpcHttpServer({ router });
    const port = await listen(server);
    const client = createTRPCClient<typeof router>({
      links: [
        httpBatchLink({
          methodOverride: 'POST',
          url: `http://127.0.0.1:${String(port)}`
        })
      ]
    });

    try {
      await expect(client.size.query({ value: 'x'.repeat(20000) })).resolves.toEqual({
        length: 20000
      });
    } finally {
      await closeServer(server);
    }
  });
});

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address !== null ? address.port : 0);
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
