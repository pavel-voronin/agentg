import { createModuleRpcClient } from '@agentg/framework';
import { telegramModule } from '@agentg/telegram';

export type GatewayTelegramClient = {
  call(method: string, params: unknown): Promise<unknown>;
  close(): void;
};

type TelegramServiceConfig = {
  url: string;
};

type TelegramRpcClient = ReturnType<typeof telegramModule.createRpcClient>;
type ServiceDirectoryProcedureResolver = {
  resolveProcedure(procedure: string): { rpcUrl: string };
};

const DEFAULT_TELEGRAM_REQUEST_TIMEOUT_MS = 15000;

export function createTrpcGatewayTelegramClient(
  config: TelegramServiceConfig
): GatewayTelegramClient {
  const telegram = createModuleRpcClient(telegramModule, config, {
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

export function createServiceDirectoryGatewayTelegramClient(
  resolver: ServiceDirectoryProcedureResolver
): GatewayTelegramClient {
  const clients = new Map<string, TelegramRpcClient>();

  return {
    call(method, params) {
      return callTelegramMethod(clientFor(method), method, params);
    },
    close() {
      for (const client of clients.values()) {
        client.close();
      }
      clients.clear();
    }
  };

  function clientFor(procedure: string): TelegramRpcClient {
    const { rpcUrl: url } = resolver.resolveProcedure(procedure);
    const existing = clients.get(url);
    if (existing !== undefined) {
      return existing;
    }

    const client = createModuleRpcClient(
      telegramModule,
      { url },
      {
        timeoutMs: DEFAULT_TELEGRAM_REQUEST_TIMEOUT_MS
      }
    );
    clients.set(url, client);
    return client;
  }
}

function callTelegramMethod(
  telegram: TelegramRpcClient,
  method: string,
  params: unknown
): Promise<unknown> {
  switch (method) {
    case 'telegram.getChat':
      return telegram.getChat(requireTelegramGetChatParams(params));
    default:
      return Promise.resolve(undefined);
  }
}

function requireTelegramGetChatParams(params: unknown): { chatId: string } {
  if (
    typeof params === 'object' &&
    params !== null &&
    'chatId' in params &&
    typeof params.chatId === 'string' &&
    params.chatId.trim() !== ''
  ) {
    return {
      chatId: params.chatId
    };
  }

  throw new Error('telegram.getChat requires chatId');
}
