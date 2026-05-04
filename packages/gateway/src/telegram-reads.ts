import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import {
  createInternalRpcCallOptionsHeaders,
  internalRpcProcedureOptions,
  type InternalRpcCallOptions
} from '@agentg/shared/rpc/call-options';
import {
  telegramGetChatInputSchema,
  telegramGetMessageInputSchema,
  telegramListRecentMessagesInputSchema,
  telegramSearchMessagesInputSchema,
  type InternalTrpcClientConfig,
  type TelegramHistoryRouter
} from '@agentg/telegram/rpc';

export type GatewayTelegramClient = {
  call(method: string, params: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  close(): void;
};

export type GatewayTelegramClientOptions = {
  timeoutMs?: number;
};

const DEFAULT_TELEGRAM_REQUEST_TIMEOUT_MS = 15000;

export function createTrpcGatewayTelegramClient(
  config: InternalTrpcClientConfig,
  options: GatewayTelegramClientOptions = {}
): GatewayTelegramClient {
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
    call(method, params, callOptions) {
      return withTimeout(
        (signal) => callTelegramJsonRpcMethod(client, method, params, signal, callOptions),
        timeoutMs
      );
    },
    close() {
      return;
    }
  };
}

async function callTelegramJsonRpcMethod(
  client: TRPCClient<TelegramHistoryRouter>,
  method: string,
  params: unknown,
  signal: AbortSignal,
  callOptions?: InternalRpcCallOptions
): Promise<unknown> {
  switch (method) {
    case 'telegram.getChat':
      return client.getChat.query(
        telegramGetChatInputSchema.parse(params),
        internalRpcProcedureOptions(callOptions, signal)
      );
    case 'telegram.getMessage':
      return client.getMessage.query(
        telegramGetMessageInputSchema.parse(params),
        internalRpcProcedureOptions(callOptions, signal)
      );
    case 'telegram.listRecentMessages':
      return client.listRecentMessages.query(
        telegramListRecentMessagesInputSchema.parse(params ?? {}),
        internalRpcProcedureOptions(callOptions, signal)
      );
    case 'telegram.searchMessages':
      return client.searchMessages.query(
        telegramSearchMessagesInputSchema.parse(params),
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
    controller.abort(new Error(`Telegram tRPC timed out after ${String(timeoutMs)}ms`));
  }, timeoutMs);
  timeout.unref();

  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
