import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import { unwrapProcedureEnvelope } from '@agentg/shared/rpc/envelope';
import {
  telegramGetChatInputSchema,
  telegramGetMessageInputSchema,
  telegramListRecentMessagesInputSchema,
  telegramSearchMessagesInputSchema,
  type InternalTrpcClientConfig,
  type TelegramHistoryRouter
} from '@agentg/telegram/rpc';

export type GatewayTelegramClient = {
  call(method: string, params: unknown): Promise<unknown>;
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
        url: config.url
      })
    ]
  });
  const timeoutMs = options.timeoutMs ?? DEFAULT_TELEGRAM_REQUEST_TIMEOUT_MS;

  return {
    call(method, params) {
      return withTimeout(
        (signal) => callTelegramJsonRpcMethod(client, method, params, signal),
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
  signal: AbortSignal
): Promise<unknown> {
  switch (method) {
    case 'telegram.getChat':
      return unwrapProcedureEnvelope(
        await client.getChat.query(telegramGetChatInputSchema.parse(params), { signal })
      );
    case 'telegram.getMessage':
      return unwrapProcedureEnvelope(
        await client.getMessage.query(telegramGetMessageInputSchema.parse(params), { signal })
      );
    case 'telegram.listRecentMessages':
      return unwrapProcedureEnvelope(
        await client.listRecentMessages.query(
          telegramListRecentMessagesInputSchema.parse(params ?? {}),
          { signal }
        )
      );
    case 'telegram.searchMessages':
      return unwrapProcedureEnvelope(
        await client.searchMessages.query(telegramSearchMessagesInputSchema.parse(params), {
          signal
        })
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
