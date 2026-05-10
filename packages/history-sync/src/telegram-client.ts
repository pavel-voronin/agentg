import { createTelegramRpcClient } from '@agentg/telegram/rpc';
import type { InternalRpcCallOptions } from '@agentg/rpc/call-options';

import type { InternalTrpcClientConfig } from './rpc/config.js';

export type TelegramHistoryChat = {
  _model: 'telegram.chat';
  id: string;
  title: string;
  type: string;
};

export type TelegramHistoryListChatsRequest = {
  discover?: boolean;
  loadBatchSize?: number;
};

export type TelegramHistoryFetchPageRequest = {
  chatId: string;
  cursorMessageId?: number;
  endAt: string;
  limit: number;
  startAt: string;
};

export type TelegramHistoryFetchPageResult =
  | {
      fetchedMessages: 0;
      kind: 'no_messages_before_end';
      storedMessages: 0;
    }
  | {
      anchorMessageDate: string;
      fetchedMessages: 0;
      kind: 'anchor_before_start';
      storedMessages: 0;
    }
  | {
      crossedStart: boolean;
      fetchedMessages: number;
      kind: 'page';
      nextCursorMessageId?: number;
      oldestFetchedMessageDate?: string;
      reachedBeginning: boolean;
      storedMessages: number;
    };

export type TelegramHistoryInterval = {
  endAt: string;
  startAt: string;
};

export type TelegramHistoryCoverageSegment = TelegramHistoryInterval & {
  coveredAt: string;
};

export type TelegramHistoryCoverageProofSegment = TelegramHistoryInterval & {
  provedAt: string;
};

export type TelegramGetHistoryCoverageResult = {
  coverage: TelegramHistoryCoverageSegment[];
  proofs: TelegramHistoryCoverageProofSegment[];
};

export type TelegramEnsureHistoryCoverageResult = {
  alreadyCovered: boolean;
  coveredIntervals: TelegramHistoryInterval[];
  fetchedMessages: number;
  pages: number;
  reachedBeginning: boolean;
  remainingIntervals: TelegramHistoryInterval[];
  storedMessages: number;
};

export type TelegramMessageInterval = {
  endAt: string;
  startAt: string;
};

export type TelegramReadChat = {
  _model: 'telegram.chat';
  id: string;
  title: string;
  type: string;
  updatedAt: string;
};

export type TelegramReadMessage = {
  _model: 'telegram.message';
  id: string;
  chat: {
    _model: 'telegram.chat';
    id: string;
  };
  contentType: string;
  deletedAt: string | null;
  editDate: string | null;
  isDeleted: boolean;
  messageDate: string | null;
  sender:
    | {
        _model: 'telegram.chat';
        id: string;
      }
    | {
        _model: 'telegram.user';
        id: string;
      }
    | null;
  senderType: string | null;
  telegramMessageId: string;
  text: string | null;
  updatedAt: string;
};

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

export type TelegramChatDirectoryEntry = TelegramReadChat & {
  isBot: boolean;
  isSelf: boolean;
  lastMessageDate: number;
  placements: TelegramChatPlacement[];
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

export type TelegramChatDirectoryRequest = {
  query?: string;
  type?: string;
};

export type TelegramChatDirectoryResult = {
  chats: TelegramChatDirectoryEntry[];
  folders: TelegramChatFolder[];
  navigationChats: TelegramChatDirectoryEntry[];
  types: TelegramChatTypeCount[];
};

export type TelegramChatHistoryFacts = {
  chat: TelegramChatDirectoryEntry | null;
  earliestMessageDate: string | null;
  messageCount: number;
};

export type TelegramReadClient = {
  countMessagesInIntervals(
    request: {
      chatId: string;
      intervals: TelegramMessageInterval[];
    },
    options?: InternalRpcCallOptions
  ): Promise<{ counts: number[] }>;
  getChat(
    request: { chatId: string },
    options?: InternalRpcCallOptions
  ): Promise<{ chat: TelegramReadChat | null }>;
  getChatHistoryFacts(
    request: { chatId: string },
    options?: InternalRpcCallOptions
  ): Promise<TelegramChatHistoryFacts>;
  getHistoryCoverage(
    request: { chatId: string },
    options?: InternalRpcCallOptions
  ): Promise<TelegramGetHistoryCoverageResult>;
  getMessage(
    request: {
      chatId: string;
      messageId: string;
    },
    options?: InternalRpcCallOptions
  ): Promise<{ message: TelegramReadMessage | null }>;
  listChatDirectory(
    request: TelegramChatDirectoryRequest,
    options?: InternalRpcCallOptions
  ): Promise<TelegramChatDirectoryResult>;
  listRecentMessages(
    request: {
      chatId?: string;
      limit?: number;
    },
    options?: InternalRpcCallOptions
  ): Promise<{ messages: TelegramReadMessage[] }>;
  searchMessages(
    request: {
      chatId?: string;
      limit?: number;
      query: string;
    },
    options?: InternalRpcCallOptions
  ): Promise<{ messages: TelegramReadMessage[] }>;
};

export type TelegramHistoryClient = {
  close?(): void;
  ensureHistoryCoverage(
    request: {
      chatId: string;
      endAt: string;
      limit?: number;
      maxPages?: number;
      requestDelayMs?: number;
      startAt: string;
    },
    options?: InternalRpcCallOptions
  ): Promise<TelegramEnsureHistoryCoverageResult>;
  fetchPage(
    request: TelegramHistoryFetchPageRequest,
    options?: InternalRpcCallOptions
  ): Promise<TelegramHistoryFetchPageResult>;
  listChats(
    request: TelegramHistoryListChatsRequest,
    options?: InternalRpcCallOptions
  ): Promise<TelegramHistoryChat[]>;
} & TelegramReadClient;

type ServiceDirectoryProcedureResolver = {
  resolveProcedure(procedure: string): { rpcUrl: string };
};

const TELEGRAM_HISTORY_SYNC_REQUEST_TIMEOUT_MS = 30000;

export function createTrpcTelegramHistoryClient(
  config: InternalTrpcClientConfig
): TelegramHistoryClient {
  const telegram = createTelegramRpcClient(config, {
    timeoutMs: TELEGRAM_HISTORY_SYNC_REQUEST_TIMEOUT_MS
  });

  return {
    close() {
      return;
    },
    countMessagesInIntervals(request, callOptions) {
      return telegram.countMessagesInIntervals(request, callOptions) as Promise<{
        counts: number[];
      }>;
    },
    ensureHistoryCoverage(request, callOptions) {
      return telegram.ensureHistoryCoverage(
        request,
        callOptions
      ) as Promise<TelegramEnsureHistoryCoverageResult>;
    },
    fetchPage(request, callOptions) {
      return telegram.fetchPage(request, callOptions) as Promise<TelegramHistoryFetchPageResult>;
    },
    getChat(request, callOptions) {
      return telegram.getChat(request, callOptions) as Promise<{ chat: TelegramReadChat | null }>;
    },
    getChatHistoryFacts(request, callOptions) {
      return telegram.getChatHistoryFacts(
        request,
        callOptions
      ) as Promise<TelegramChatHistoryFacts>;
    },
    getHistoryCoverage(request, callOptions) {
      return telegram.getHistoryCoverage(
        request,
        callOptions
      ) as Promise<TelegramGetHistoryCoverageResult>;
    },
    getMessage(request, callOptions) {
      return telegram.getMessage(request, callOptions) as Promise<{
        message: TelegramReadMessage | null;
      }>;
    },
    listChatDirectory(request, callOptions) {
      return telegram.listChatDirectory(
        request,
        callOptions
      ) as Promise<TelegramChatDirectoryResult>;
    },
    listChats(request, callOptions) {
      return telegram.listChats(request, callOptions) as Promise<TelegramHistoryChat[]>;
    },
    listRecentMessages(request, callOptions) {
      return telegram.listRecentMessages(request, callOptions) as Promise<{
        messages: TelegramReadMessage[];
      }>;
    },
    searchMessages(request, callOptions) {
      return telegram.searchMessages(request, callOptions) as Promise<{
        messages: TelegramReadMessage[];
      }>;
    }
  };
}

export function createServiceDirectoryTelegramHistoryClient(
  resolver: ServiceDirectoryProcedureResolver
): TelegramHistoryClient {
  const clients = new Map<string, ReturnType<typeof createTelegramRpcClient>>();

  return {
    close() {
      for (const client of clients.values()) {
        client.close();
      }
      clients.clear();
    },
    countMessagesInIntervals(request, callOptions) {
      return clientFor('telegram.countMessagesInIntervals').countMessagesInIntervals(
        request,
        callOptions
      ) as Promise<{ counts: number[] }>;
    },
    ensureHistoryCoverage(request, callOptions) {
      return clientFor('telegram.ensureHistoryCoverage').ensureHistoryCoverage(
        request,
        callOptions
      ) as Promise<TelegramEnsureHistoryCoverageResult>;
    },
    fetchPage(request, callOptions) {
      return clientFor('telegram.fetchPage').fetchPage(
        request,
        callOptions
      ) as Promise<TelegramHistoryFetchPageResult>;
    },
    getChat(request, callOptions) {
      return clientFor('telegram.getChat').getChat(request, callOptions) as Promise<{
        chat: TelegramReadChat | null;
      }>;
    },
    getChatHistoryFacts(request, callOptions) {
      return clientFor('telegram.getChatHistoryFacts').getChatHistoryFacts(
        request,
        callOptions
      ) as Promise<TelegramChatHistoryFacts>;
    },
    getHistoryCoverage(request, callOptions) {
      return clientFor('telegram.getHistoryCoverage').getHistoryCoverage(
        request,
        callOptions
      ) as Promise<TelegramGetHistoryCoverageResult>;
    },
    getMessage(request, callOptions) {
      return clientFor('telegram.getMessage').getMessage(request, callOptions) as Promise<{
        message: TelegramReadMessage | null;
      }>;
    },
    listChatDirectory(request, callOptions) {
      return clientFor('telegram.listChatDirectory').listChatDirectory(
        request,
        callOptions
      ) as Promise<TelegramChatDirectoryResult>;
    },
    listChats(request, callOptions) {
      return clientFor('telegram.listChats').listChats(request, callOptions) as Promise<
        TelegramHistoryChat[]
      >;
    },
    listRecentMessages(request, callOptions) {
      return clientFor('telegram.listRecentMessages').listRecentMessages(
        request,
        callOptions
      ) as Promise<{ messages: TelegramReadMessage[] }>;
    },
    searchMessages(request, callOptions) {
      return clientFor('telegram.searchMessages').searchMessages(request, callOptions) as Promise<{
        messages: TelegramReadMessage[];
      }>;
    }
  };

  function clientFor(procedure: string): ReturnType<typeof createTelegramRpcClient> {
    const { rpcUrl: url } = resolver.resolveProcedure(procedure);
    const existing = clients.get(url);
    if (existing !== undefined) {
      return existing;
    }

    const client = createTelegramRpcClient(
      { url },
      {
        timeoutMs: TELEGRAM_HISTORY_SYNC_REQUEST_TIMEOUT_MS
      }
    );
    clients.set(url, client);
    return client;
  }
}
