import type { Server } from 'node:http';

import { createInternalTrpcClient } from '@agentg/framework/client';
import { createInternalTrpcHttpServer } from '@agentg/framework/http-server';
import { createInternalTrpcService } from '@agentg/framework/trpc';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('Telegram tRPC foundation', () => {
  it('performs a package-local tRPC client/server round trip', async () => {
    const testRpc = createInternalTrpcService('telegram-test');
    const testRouter = testRpc.router({
      domainError: testRpc.procedure.output(z.object({ value: z.string() })).query(() => {
        throw new Error('Telegram value was not found');
      }),
      echo: testRpc.procedure
        .input(z.object({ value: z.string() }))
        .output(z.object({ value: z.string() }))
        .query(({ input }) => ({
          value: input.value
        }))
    });
    const server = createInternalTrpcHttpServer({
      createContext: testRpc.createContext,
      router: testRouter
    });
    const port = await listenEphemeral(server);
    const client = createInternalTrpcClient<typeof testRouter>({
      url: `http://127.0.0.1:${String(port)}`
    });

    try {
      await expect(client.echo.query({ value: 'telegram' })).resolves.toEqual({
        value: 'telegram'
      });
      await expect(client.domainError.query()).rejects.toThrow('Telegram value was not found');
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
