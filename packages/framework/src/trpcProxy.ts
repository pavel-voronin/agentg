import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client';

import { createInternalRpcCallOptionsHeaders, internalRpcProcedureOptions } from './callOptions.js';

export type InternalTrpcProcedureKind = 'mutation' | 'query';

export type InternalTrpcProcedureCall = {
  kind: InternalTrpcProcedureKind;
  rpcUrl: string;
};

export type InternalTrpcProcedureResolver = {
  resolveProcedure(procedure: string): InternalTrpcProcedureCall;
};

export type InternalTrpcProcedureProxy = {
  call(method: string, params: unknown): Promise<unknown>;
  close(): void;
};

export function createInternalTrpcProcedureProxy(
  resolver: InternalTrpcProcedureResolver,
  options: { timeoutMs: number }
): InternalTrpcProcedureProxy {
  const clients = new Map<string, ReturnType<typeof createTRPCUntypedClient>>();

  return {
    async call(method, params) {
      const procedure = resolver.resolveProcedure(method);
      const client = clientFor(procedure.rpcUrl);
      const localPath = localProcedurePath(method);
      if (procedure.kind === 'mutation') {
        return callProcedure(options.timeoutMs, (signal) =>
          client.mutation(localPath, params, internalRpcProcedureOptions(undefined, signal))
        );
      }
      return callProcedure(options.timeoutMs, (signal) =>
        client.query(localPath, params, internalRpcProcedureOptions(undefined, signal))
      );
    },
    close() {
      clients.clear();
    }
  };

  function clientFor(rpcUrl: string): ReturnType<typeof createTRPCUntypedClient> {
    const existing = clients.get(rpcUrl);
    if (existing !== undefined) {
      return existing;
    }

    const client = createTRPCUntypedClient({
      links: [
        httpBatchLink({
          headers: ({ opList }) => createInternalRpcCallOptionsHeaders(opList),
          url: parseRpcServiceUrl(rpcUrl)
        })
      ]
    });
    clients.set(rpcUrl, client);
    return client;
  }
}

function localProcedurePath(method: string): string {
  const separatorIndex = method.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex === method.length - 1) {
    throw new Error(`RPC method must use service.procedure format: ${method}`);
  }

  return method.slice(separatorIndex + 1);
}

async function callProcedure<T>(
  timeoutMs: number,
  call: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Internal tRPC call timed out after ${String(timeoutMs)}ms`));
  }, timeoutMs);
  timeout.unref();

  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function parseRpcServiceUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch (error) {
    throw new Error('RPC URL must be a valid http(s) URL', { cause: error });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('RPC URL must use http or https');
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error('RPC URL must not include credentials');
  }

  if (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0) {
    throw new Error('RPC URL must point to a service root');
  }

  return url.toString().replace(/\/$/, '');
}
