import { createTRPCClient, httpBatchLink } from '@trpc/client';
import {
  createInternalRpcCallOptionsHeaders,
  internalRpcProcedureOptions,
  type InternalRpcCallOptions
} from '@agentg/shared/rpc/call-options';

import {
  summariesChatSummaryInputSchema,
  summariesReadChatSummaryInputSchema,
  summariesReadSummaryRunInputSchema,
  summariesRequestSummaryInputSchema
} from './contracts.js';
import type { SummariesRouter } from './router.js';

type SummariesRpcClientConfig = {
  url: string;
};

type SummariesRpcClientOptions = {
  timeoutMs?: number;
};

type SummariesRpcClient = {
  chatSummary(input: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  close(): void;
  readChatSummary(input: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  readSummaryRun(input: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  requestSummary(input: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
};

const SUMMARIES_REQUEST_TIMEOUT_MS = 15000;

export function createSummariesRpcClient(
  config: SummariesRpcClientConfig,
  options: SummariesRpcClientOptions = {}
): SummariesRpcClient {
  const client = createTRPCClient<SummariesRouter>({
    links: [
      httpBatchLink({
        headers: ({ opList }) => createInternalRpcCallOptionsHeaders(opList),
        url: parseSummariesRpcUrl(config.url)
      })
    ]
  });
  const timeoutMs = options.timeoutMs ?? SUMMARIES_REQUEST_TIMEOUT_MS;

  return {
    chatSummary(input, callOptions) {
      return callSummariesProcedure(
        (signal) =>
          client.summaries.chatSummary.query(
            summariesChatSummaryInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    },
    close() {
      return;
    },
    readChatSummary(input, callOptions) {
      return callSummariesProcedure(
        (signal) =>
          client.summaries.readChatSummary.query(
            summariesReadChatSummaryInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    },
    readSummaryRun(input, callOptions) {
      return callSummariesProcedure(
        (signal) =>
          client.summaries.readSummaryRun.query(
            summariesReadSummaryRunInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    },
    requestSummary(input, callOptions) {
      return callSummariesProcedure(
        (signal) =>
          client.summaries.requestSummary.mutate(
            summariesRequestSummaryInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    }
  };
}

async function callSummariesProcedure<T>(
  call: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Summaries tRPC timed out after ${String(timeoutMs)}ms`));
  }, timeoutMs);
  timeout.unref();

  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function parseSummariesRpcUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch (error) {
    throw new Error('Summaries RPC URL must be a valid http(s) URL', { cause: error });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Summaries RPC URL must use http or https');
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error('Summaries RPC URL must not include credentials');
  }

  if (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0) {
    throw new Error('Summaries RPC URL must point to a service root');
  }

  return url.toString().replace(/\/$/, '');
}
