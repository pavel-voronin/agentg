import { createTRPCClient, httpBatchLink } from '@trpc/client';
import {
  createInternalRpcCallOptionsHeaders,
  internalRpcProcedureOptions
} from '@agentg/rpc/call-options';

import {
  historySyncDeleteTargetInputSchema,
  historySyncGetChatHistorySyncStateInputSchema,
  historySyncRequestSyncInputSchema,
  historySyncUpsertTargetInputSchema
} from './history-sync-contracts.js';
import type { HistorySyncRouter } from './router.js';

type HistorySyncRpcClientConfig = {
  url: string;
};

type HistorySyncRpcClient = {
  close(): void;
  deleteTarget(input: unknown): Promise<unknown>;
  getChatHistorySyncState(input: unknown): Promise<unknown>;
  requestSync(input?: unknown): Promise<unknown>;
  upsertTarget(input: unknown): Promise<unknown>;
};

const HISTORY_SYNC_REQUEST_TIMEOUT_MS = 15000;

export function createHistorySyncRpcClient(
  config: HistorySyncRpcClientConfig
): HistorySyncRpcClient {
  const client = createTRPCClient<HistorySyncRouter>({
    links: [
      httpBatchLink({
        headers: ({ opList }) => createInternalRpcCallOptionsHeaders(opList),
        methodOverride: 'POST',
        url: parseHistorySyncRpcUrl(config.url)
      })
    ]
  });

  return {
    close() {
      return;
    },
    deleteTarget(input) {
      return callHistorySyncProcedure((signal) =>
        client.deleteTarget.mutate(
          historySyncDeleteTargetInputSchema.parse(input),
          internalRpcProcedureOptions(undefined, signal)
        )
      );
    },
    getChatHistorySyncState(input) {
      return callHistorySyncProcedure((signal) =>
        client.getChatHistorySyncState.query(
          historySyncGetChatHistorySyncStateInputSchema.parse(input),
          internalRpcProcedureOptions(undefined, signal)
        )
      );
    },
    requestSync(input = {}) {
      return callHistorySyncProcedure((signal) =>
        client.requestSync.mutate(
          historySyncRequestSyncInputSchema.parse(input),
          internalRpcProcedureOptions(undefined, signal)
        )
      );
    },
    upsertTarget(input) {
      return callHistorySyncProcedure((signal) =>
        client.upsertTarget.mutate(
          historySyncUpsertTargetInputSchema.parse(input),
          internalRpcProcedureOptions(undefined, signal)
        )
      );
    }
  };
}

async function callHistorySyncProcedure<T>(call: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new Error(`History Sync tRPC timed out after ${String(HISTORY_SYNC_REQUEST_TIMEOUT_MS)}ms`)
    );
  }, HISTORY_SYNC_REQUEST_TIMEOUT_MS);
  timeout.unref();

  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function parseHistorySyncRpcUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch (error) {
    throw new Error('History Sync RPC URL must be a valid http(s) URL', { cause: error });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('History Sync RPC URL must use http or https');
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error('History Sync RPC URL must not include credentials');
  }

  if (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0) {
    throw new Error('History Sync RPC URL must point to a service root');
  }

  return url.toString().replace(/\/$/, '');
}
