import { initTRPC } from '@trpc/server';
import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';
import { treeifyError, ZodError } from 'zod';

export const INTERNAL_RPC_CORRELATION_ID_HEADER = 'x-agentg-correlation-id';

export type HistoryRpcContext = {
  correlationId?: string;
};

export function createHistoryRpcContext(options: CreateHTTPContextOptions): HistoryRpcContext {
  const correlationId = optionalHeader(options.req.headers[INTERNAL_RPC_CORRELATION_ID_HEADER]);

  return correlationId === undefined ? {} : { correlationId };
}

const historyRpc = initTRPC.context<HistoryRpcContext>().create({
  errorFormatter({ error, shape }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? treeifyError(error.cause) : null
      }
    };
  }
});

export const historyRpcRouter = historyRpc.router;
export const historyRpcProcedure = historyRpc.procedure;

function optionalHeader(value: string | string[] | undefined): string | undefined {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return typeof firstValue === 'string' && firstValue.trim().length > 0
    ? firstValue.trim()
    : undefined;
}
