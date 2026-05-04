import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import {
  createInternalRpcCallOptionsHeaders,
  internalRpcProcedureOptions,
  type InternalRpcCallOptions
} from '@agentg/shared/rpc/call-options';
import type {
  InternalTrpcClientConfig,
  TelegramHistoryRouter,
  TelegramListChatDirectoryInput,
  TelegramListChatDirectoryOutput
} from '@agentg/telegram/rpc';
import { telegramListChatDirectoryInputSchema } from '@agentg/telegram/rpc';

export type TelegramDirectoryClient = {
  close(): void;
  listChatDirectory(
    request: TelegramListChatDirectoryInput,
    options?: InternalRpcCallOptions
  ): Promise<TelegramListChatDirectoryOutput>;
};

export type TelegramDirectoryClientOptions = {
  timeoutMs?: number;
};

const DEFAULT_TELEGRAM_REQUEST_TIMEOUT_MS = 15000;

export function createTrpcTelegramDirectoryClient(
  config: InternalTrpcClientConfig,
  options: TelegramDirectoryClientOptions = {}
): TelegramDirectoryClient {
  const client = createTRPCClient<TelegramHistoryRouter>({
    links: [
      httpBatchLink({
        headers: ({ opList }) => createInternalRpcCallOptionsHeaders(opList),
        url: config.url
      })
    ]
  });
  const timeoutMs = options.timeoutMs ?? DEFAULT_TELEGRAM_REQUEST_TIMEOUT_MS;

  return {
    close() {
      return;
    },
    listChatDirectory(request, callOptions) {
      return withTimeout(
        (signal) => callTelegramListChatDirectory(client, request, signal, callOptions),
        timeoutMs
      );
    }
  };
}

function callTelegramListChatDirectory(
  client: TRPCClient<TelegramHistoryRouter>,
  request: TelegramListChatDirectoryInput,
  signal: AbortSignal,
  callOptions?: InternalRpcCallOptions
): Promise<TelegramListChatDirectoryOutput> {
  return client.listChatDirectory.query(
    telegramListChatDirectoryInputSchema.parse(request),
    internalRpcProcedureOptions(callOptions, signal)
  );
}

async function withTimeout<T>(
  call: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Telegram tRPC timed out after ${String(timeoutMs)}ms`));
  }, timeoutMs);
  timeout.unref();

  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
