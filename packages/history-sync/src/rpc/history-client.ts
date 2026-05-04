import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import {
  createInternalRpcCallOptionsHeaders,
  internalRpcProcedureOptions,
  type InternalRpcCallOptions
} from '@agentg/shared/rpc/call-options';

import type { InternalTrpcClientConfig } from './config.js';
import {
  historyDeleteTargetInputSchema,
  historyGetChatHistoryStateInputSchema,
  historyGetChatStatsInputSchema,
  historyListJobsInputSchema,
  historyRequestSyncInputSchema,
  historyUpsertTargetInputSchema
} from './history-contracts.js';
import type { HistoryRouter } from './history-router.js';

export type HistoryJsonRpcClient = {
  call(method: string, params: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  close(): void;
};

export type HistoryJsonRpcClientOptions = {
  timeoutMs?: number;
};

const DEFAULT_HISTORY_REQUEST_TIMEOUT_MS = 15000;

export function createTrpcHistoryJsonRpcClient(
  config: InternalTrpcClientConfig,
  options: HistoryJsonRpcClientOptions = {}
): HistoryJsonRpcClient {
  const client = createTRPCClient<HistoryRouter>({
    links: [
      httpBatchLink({
        headers: ({ opList }) => createInternalRpcCallOptionsHeaders(opList),
        url: config.url
      })
    ]
  });
  const timeoutMs = options.timeoutMs ?? DEFAULT_HISTORY_REQUEST_TIMEOUT_MS;

  return {
    call(method, params, callOptions) {
      return withTimeout(
        (signal) => callHistoryJsonRpcMethod(client, method, params, signal, callOptions),
        timeoutMs
      );
    },
    close() {
      return;
    }
  };
}

async function callHistoryJsonRpcMethod(
  client: TRPCClient<HistoryRouter>,
  method: string,
  params: unknown,
  signal: AbortSignal,
  callOptions?: InternalRpcCallOptions
): Promise<unknown> {
  switch (method) {
    case 'history.deleteTarget':
      return client.deleteTarget.mutate(
        historyDeleteTargetInputSchema.parse(params),
        internalRpcProcedureOptions(callOptions, signal)
      );
    case 'history.getChatHistoryState':
      return client.getChatHistoryState.query(
        historyGetChatHistoryStateInputSchema.parse(params),
        internalRpcProcedureOptions(callOptions, signal)
      );
    case 'history.getChatStats':
      return client.getChatStats.query(
        historyGetChatStatsInputSchema.parse(params),
        internalRpcProcedureOptions(callOptions, signal)
      );
    case 'history.getOverview':
      return client.getOverview.query(undefined, internalRpcProcedureOptions(callOptions, signal));
    case 'history.listJobs':
      return client.listJobs.query(
        historyListJobsInputSchema.parse(params ?? {}),
        internalRpcProcedureOptions(callOptions, signal)
      );
    case 'history.requestSync':
      return client.requestSync.mutate(
        historyRequestSyncInputSchema.parse(params ?? {}),
        internalRpcProcedureOptions(callOptions, signal)
      );
    case 'history.upsertTarget':
      return client.upsertTarget.mutate(
        historyUpsertTargetInputSchema.parse(params),
        internalRpcProcedureOptions(callOptions, signal)
      );
    default:
      return undefined;
  }
}

async function withTimeout<T>(
  call: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`History tRPC timed out after ${String(timeoutMs)}ms`));
  }, timeoutMs);
  timeout.unref();

  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
