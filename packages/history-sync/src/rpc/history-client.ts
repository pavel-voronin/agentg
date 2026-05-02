import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import { unwrapProcedureEnvelope } from '@agentg/shared/rpc/envelope';

import type { InternalTrpcClientConfig } from './config.js';
import {
  historyDeleteTargetInputSchema,
  historyGetChatHistoryStateInputSchema,
  historyListChatsInputSchema,
  historyListJobsInputSchema,
  historyRequestSyncInputSchema,
  historyUpsertTargetInputSchema
} from './history-contracts.js';
import type { HistoryRouter } from './history-router.js';

export type HistoryJsonRpcClient = {
  call(method: string, params: unknown): Promise<unknown>;
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
        url: config.url
      })
    ]
  });
  const timeoutMs = options.timeoutMs ?? DEFAULT_HISTORY_REQUEST_TIMEOUT_MS;

  return {
    call(method, params) {
      return withTimeout(
        (signal) => callHistoryJsonRpcMethod(client, method, params, signal),
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
  signal: AbortSignal
): Promise<unknown> {
  switch (method) {
    case 'history.deleteTarget':
      return unwrapProcedureEnvelope(
        await client.deleteTarget.mutate(historyDeleteTargetInputSchema.parse(params), { signal })
      );
    case 'history.getChatHistoryState':
      return unwrapProcedureEnvelope(
        await client.getChatHistoryState.query(
          historyGetChatHistoryStateInputSchema.parse(params),
          {
            signal
          }
        )
      );
    case 'history.getOverview':
      return unwrapProcedureEnvelope(await client.getOverview.query(undefined, { signal }));
    case 'history.listChats':
      return unwrapProcedureEnvelope(
        await client.listChats.query(historyListChatsInputSchema.parse(params ?? {}), { signal })
      );
    case 'history.listJobs':
      return unwrapProcedureEnvelope(
        await client.listJobs.query(historyListJobsInputSchema.parse(params ?? {}), { signal })
      );
    case 'history.requestSync':
      return unwrapProcedureEnvelope(
        await client.requestSync.mutate(historyRequestSyncInputSchema.parse(params ?? {}), {
          signal
        })
      );
    case 'history.upsertTarget':
      return unwrapProcedureEnvelope(
        await client.upsertTarget.mutate(historyUpsertTargetInputSchema.parse(params), { signal })
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
