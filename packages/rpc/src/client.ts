import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AnyRouter } from '@trpc/server/unstable-core-do-not-import';

import { createInternalRpcCallOptionsHeaders, type InternalRpcOperation } from './callOptions.js';
import { parseInternalTrpcUrl, type InternalTrpcClientConfig } from './config.js';

export type InternalTrpcClientOptions = {
  timeoutMs?: number;
  timeoutMessage: string;
};

export function createInternalTrpcClient<TRouter extends AnyRouter>(
  config: InternalTrpcClientConfig
): ReturnType<typeof createTRPCClient<TRouter>> {
  return createTRPCClient<TRouter>({
    links: [
      httpBatchLink({
        headers: ({ opList }: { opList: readonly InternalRpcOperation[] }) =>
          createInternalRpcCallOptionsHeaders(opList),
        methodOverride: 'POST',
        url: parseInternalTrpcUrl(config.url)
      } as unknown as Parameters<typeof httpBatchLink<TRouter>>[0])
    ]
  });
}

export async function callInternalTrpcProcedure<T>(
  call: (signal: AbortSignal) => Promise<T>,
  options: InternalTrpcClientOptions
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`${options.timeoutMessage} after ${String(timeoutMs)}ms`));
  }, timeoutMs);
  timeout.unref();

  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
