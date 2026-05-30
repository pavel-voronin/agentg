import { describe, expect, it } from 'vitest';

import { startProcedureServer } from '../src/rpc/httpRpc.js';

describe('http RPC transport', () => {
  it('rejects oversized procedure request bodies before procedure dispatch', async () => {
    const server = await startProcedureServer(
      {
        failIfCalled() {
          throw new Error('procedure should not be called');
        }
      },
      { port: 0 }
    );

    try {
      const response = await fetch(`${server.url}/rpc`, {
        body: 'x'.repeat(1_000_001),
        headers: {
          'content-type': 'application/json'
        },
        method: 'POST'
      });

      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: 'payload_too_large',
          message: 'Procedure request body exceeds 1000000 bytes'
        },
        ok: false
      });
    } finally {
      await server.stop();
    }
  });
});
