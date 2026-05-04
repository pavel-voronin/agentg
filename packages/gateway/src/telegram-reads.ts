import { createTelegramRpcClient } from '@agentg/telegram/rpc';

export type GatewayTelegramClient = {
  call(method: string, params: unknown): Promise<unknown>;
  close(): void;
};

type TelegramServiceConfig = {
  url: string;
};

type TelegramRpcClient = ReturnType<typeof createTelegramRpcClient>;

const DEFAULT_TELEGRAM_REQUEST_TIMEOUT_MS = 15000;

export function createTrpcGatewayTelegramClient(
  config: TelegramServiceConfig
): GatewayTelegramClient {
  const telegram = createTelegramRpcClient(config, {
    timeoutMs: DEFAULT_TELEGRAM_REQUEST_TIMEOUT_MS
  });

  return {
    call(method, params) {
      return callTelegramMethod(telegram, method, params);
    },
    close() {
      telegram.close();
    }
  };
}

function callTelegramMethod(
  telegram: TelegramRpcClient,
  method: string,
  params: unknown
): Promise<unknown> {
  switch (method) {
    case 'telegram.getChat':
      return telegram.getChat(params);
    case 'telegram.getMessage':
      return telegram.getMessage(params);
    case 'telegram.listRecentMessages':
      return telegram.listRecentMessages(params);
    case 'telegram.searchMessages':
      return telegram.searchMessages(params);
    default:
      return Promise.resolve(undefined);
  }
}
