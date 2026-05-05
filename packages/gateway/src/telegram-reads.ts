import { createTelegramRpcClient } from '@agentg/telegram/rpc';

export type GatewayTelegramClient = {
  call(method: string, params: unknown): Promise<unknown>;
  close(): void;
};

type TelegramServiceConfig = {
  url: string;
};

type TelegramRpcClient = ReturnType<typeof createTelegramRpcClient>;
type ServiceDirectoryProcedureResolver = {
  resolveProcedure(procedure: string): string;
};

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
    const url = resolver.resolveProcedure(procedure);
    const existing = clients.get(url);
    if (existing !== undefined) {
      return existing;
    }

    const client = createTelegramRpcClient(
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
      return telegram.getChat(params);
    default:
      return Promise.resolve(undefined);
  }
}
