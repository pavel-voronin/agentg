import type { Server } from 'node:http';

import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createInternalTrpcProcedureProxy } from '../src/trpc-proxy.js';
import { rpc } from './trpc-test.js';

const servers: Server[] = [];

describe('internal tRPC procedure proxy', () => {
  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer));
  });

  it('resolves full procedure ids but calls local tRPC paths', async () => {
    const calls: string[] = [];
    const router = rpc.router({
      getStatus: rpc.procedure.query(() => {
        calls.push('getStatus');
        return { value: 3 };
      }),
      upsertTarget: rpc.procedure.input(z.object({ id: z.string() })).mutation(({ input }) => {
        calls.push(`upsertTarget:${input.id}`);
        return { ok: true };
      })
    });
    const server = createHTTPServer({ router });
    const port = await listen(server);
    servers.push(server);
    const proxy = createInternalTrpcProcedureProxy(
      {
        resolveProcedure(procedure) {
          if (procedure === 'alpha.getStatus') {
            return { kind: 'query', rpcUrl: `http://127.0.0.1:${String(port)}` };
          }
          if (procedure === 'alpha.upsertTarget') {
            return { kind: 'mutation', rpcUrl: `http://127.0.0.1:${String(port)}` };
          }
          throw new Error(`Unknown procedure: ${procedure}`);
        }
      },
      { timeoutMs: 1000 }
    );

    await expect(proxy.call('alpha.getStatus', undefined)).resolves.toEqual({ value: 3 });
    await expect(proxy.call('alpha.upsertTarget', { id: 'target-a' })).resolves.toEqual({
      ok: true
    });
    expect(calls).toEqual(['getStatus', 'upsertTarget:target-a']);
    proxy.close();
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
