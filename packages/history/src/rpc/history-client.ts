import { createTRPCClient, httpBatchLink } from '@trpc/client';
import {
  createInternalRpcCallOptionsHeaders,
  internalRpcProcedureOptions
} from '@agentg/rpc/call-options';

import {
  historyDeleteTargetInputSchema,
  historyGetChatHistoryStateInputSchema,
  historyGetChatStatsInputSchema,
  historyListJobsInputSchema,
  historyRequestSyncInputSchema,
  historyUpsertTargetInputSchema
} from './history-contracts.js';
import type { HistoryRouter } from './router.js';

type HistoryRpcClientConfig = {
  url: string;
};

type HistoryRpcClient = {
  close(): void;
  deleteTarget(input: unknown): Promise<unknown>;
  getChatHistoryState(input: unknown): Promise<unknown>;
  getChatStats(input: unknown): Promise<unknown>;
  listJobs(input?: unknown): Promise<unknown>;
  requestSync(input?: unknown): Promise<unknown>;
  upsertTarget(input: unknown): Promise<unknown>;
};

const HISTORY_REQUEST_TIMEOUT_MS = 15000;

export function createHistoryRpcClient(config: HistoryRpcClientConfig): HistoryRpcClient {
  const client = createTRPCClient<HistoryRouter>({
    links: [
      httpBatchLink({
        headers: ({ opList }) => createInternalRpcCallOptionsHeaders(opList),
        methodOverride: 'POST',
        url: parseHistoryRpcUrl(config.url)
      })
    ]
  });

  return {
    close() {
      return;
    },
    deleteTarget(input) {
      return callHistoryProcedure((signal) =>
        client.deleteTarget.mutate(
          historyDeleteTargetInputSchema.parse(input),
          internalRpcProcedureOptions(undefined, signal)
        )
      );
    },
    getChatHistoryState(input) {
      return callHistoryProcedure((signal) =>
        client.getChatHistoryState.query(
          historyGetChatHistoryStateInputSchema.parse(input),
          internalRpcProcedureOptions(undefined, signal)
        )
      );
    },
    getChatStats(input) {
      return callHistoryProcedure((signal) =>
        client.getChatStats.query(
          historyGetChatStatsInputSchema.parse(input),
          internalRpcProcedureOptions(undefined, signal)
        )
      );
    },
    listJobs(input = {}) {
      return callHistoryProcedure((signal) =>
        client.listJobs.query(
          historyListJobsInputSchema.parse(input),
          internalRpcProcedureOptions(undefined, signal)
        )
      );
    },
    requestSync(input = {}) {
      return callHistoryProcedure((signal) =>
        client.requestSync.mutate(
          historyRequestSyncInputSchema.parse(input),
          internalRpcProcedureOptions(undefined, signal)
        )
      );
    },
    upsertTarget(input) {
      return callHistoryProcedure((signal) =>
        client.upsertTarget.mutate(
          historyUpsertTargetInputSchema.parse(input),
          internalRpcProcedureOptions(undefined, signal)
        )
      );
    }
  };
}

async function callHistoryProcedure<T>(call: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new Error(`History tRPC timed out after ${String(HISTORY_REQUEST_TIMEOUT_MS)}ms`)
    );
  }, HISTORY_REQUEST_TIMEOUT_MS);
  timeout.unref();

  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function parseHistoryRpcUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch (error) {
    throw new Error('History RPC URL must be a valid http(s) URL', { cause: error });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('History RPC URL must use http or https');
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error('History RPC URL must not include credentials');
  }

  if (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0) {
    throw new Error('History RPC URL must point to a service root');
  }

  return url.toString().replace(/\/$/, '');
}
