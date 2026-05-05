import { createTelegramRpcClient } from '@agentg/telegram/rpc';
import type { InternalRpcCallOptions } from '@agentg/shared/rpc/call-options';

export type TelegramChatPlacement =
  | {
      kind: 'archive';
      order: string;
    }
  | {
      kind: 'main';
      order: string;
    }
  | {
      folderId: number;
      kind: 'folder';
      order: string;
    };

export type TelegramChatDirectoryEntry = {
  _model: 'telegram.chat';
  id: string;
  isBot: boolean;
  isSelf: boolean;
  lastMessageDate: number;
  placements: TelegramChatPlacement[];
  title: string;
  type: string;
  updatedAt: string;
};

export type TelegramChatFolder = {
  _model: 'telegram.chatFolder';
  folderId: number;
  iconName: string | null;
  id: string;
  position: number;
  title: string;
};

export type TelegramChatTypeCount = {
  count: number;
  type: string;
};

export type TelegramListChatDirectoryInput = {
  query?: string;
  type?: string;
};

export type TelegramListChatDirectoryOutput = {
  chats: TelegramChatDirectoryEntry[];
  folders: TelegramChatFolder[];
  navigationChats: TelegramChatDirectoryEntry[];
  types: TelegramChatTypeCount[];
};

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

type TelegramServiceConfig = {
  url: string;
};
type ServiceDirectoryProcedureResolver = {
  resolveProcedure(procedure: string): string;
};

const DEFAULT_TELEGRAM_REQUEST_TIMEOUT_MS = 15000;

export function createTrpcTelegramDirectoryClient(
  config: TelegramServiceConfig,
  options: TelegramDirectoryClientOptions = {}
): TelegramDirectoryClient {
  const telegram = createTelegramRpcClient(config, {
    timeoutMs: options.timeoutMs ?? DEFAULT_TELEGRAM_REQUEST_TIMEOUT_MS
  });

  return {
    close() {
      telegram.close();
    },
    listChatDirectory(request, callOptions) {
      return telegram.listChatDirectory(
        request,
        callOptions
      ) as Promise<TelegramListChatDirectoryOutput>;
    }
  };
}

export function createServiceDirectoryTelegramDirectoryClient(
  resolver: ServiceDirectoryProcedureResolver,
  options: TelegramDirectoryClientOptions = {}
): TelegramDirectoryClient {
  const clients = new Map<string, ReturnType<typeof createTelegramRpcClient>>();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TELEGRAM_REQUEST_TIMEOUT_MS;

  return {
    close() {
      for (const client of clients.values()) {
        client.close();
      }
      clients.clear();
    },
    listChatDirectory(request, callOptions) {
      return clientFor('telegram.listChatDirectory').listChatDirectory(
        request,
        callOptions
      ) as Promise<TelegramListChatDirectoryOutput>;
    }
  };

  function clientFor(procedure: string): ReturnType<typeof createTelegramRpcClient> {
    const url = resolver.resolveProcedure(procedure);
    const existing = clients.get(url);
    if (existing !== undefined) {
      return existing;
    }

    const client = createTelegramRpcClient(
      { url },
      {
        timeoutMs
      }
    );
    clients.set(url, client);
    return client;
  }
}
