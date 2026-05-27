import {
  createTelegramRpcClient,
  type TelegramChatDirectoryEntry,
  type TelegramChatFolder,
  type TelegramChatTypeCount,
  type TelegramCountMessagesInIntervalsOutput,
  type TelegramEnsureHistoryCoverageInput,
  type TelegramEnsureHistoryCoverageOutput,
  type TelegramGetChatHistoryFactsOutput,
  type TelegramGetChatOutput,
  type TelegramGetHistoryCoverageOutput,
  type TelegramGetMessageOutput,
  type TelegramHistoryChat,
  type TelegramHistoryCoverageSegment,
  type TelegramHistoryFetchPageRequest,
  type TelegramHistoryFetchPageResult,
  type TelegramHistoryInterval,
  type TelegramHistoryListChatsRequest,
  type TelegramListChatDirectoryInput,
  type TelegramListChatDirectoryOutput,
  type TelegramListRecentMessagesInput,
  type TelegramListRecentMessagesOutput,
  type TelegramReadChat,
  type TelegramReadMessage,
  type TelegramSearchMessagesInput,
  type TelegramSearchMessagesOutput
} from '@agentg/telegram/rpc';
import type { InternalRpcCallOptions } from '@agentg/rpc/call-options';

import type { InternalTrpcClientConfig } from './rpc/config.js';

export type {
  TelegramChatDirectoryEntry,
  TelegramChatFolder,
  TelegramChatTypeCount,
  TelegramHistoryChat,
  TelegramHistoryCoverageSegment,
  TelegramHistoryFetchPageRequest,
  TelegramHistoryFetchPageResult,
  TelegramHistoryInterval,
  TelegramHistoryListChatsRequest,
  TelegramReadChat,
  TelegramReadMessage
};

export type TelegramChatDirectoryRequest = TelegramListChatDirectoryInput;
export type TelegramChatDirectoryResult = TelegramListChatDirectoryOutput;
export type TelegramChatHistoryFacts = TelegramGetChatHistoryFactsOutput;
export type TelegramEnsureHistoryCoverageResult = TelegramEnsureHistoryCoverageOutput;
export type TelegramGetHistoryCoverageResult = TelegramGetHistoryCoverageOutput;
export type TelegramMessageInterval = TelegramHistoryInterval;

export type TelegramReadClient = {
  countMessagesInIntervals(
    request: {
      chatId: string;
      intervals: TelegramMessageInterval[];
    },
    options?: InternalRpcCallOptions
  ): Promise<TelegramCountMessagesInIntervalsOutput>;
  getChat(
    request: { chatId: string },
    options?: InternalRpcCallOptions
  ): Promise<TelegramGetChatOutput>;
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
  ): Promise<TelegramGetMessageOutput>;
  listChatDirectory(
    request: TelegramChatDirectoryRequest,
    options?: InternalRpcCallOptions
  ): Promise<TelegramChatDirectoryResult>;
  listRecentMessages(
    request: TelegramListRecentMessagesInput,
    options?: InternalRpcCallOptions
  ): Promise<TelegramListRecentMessagesOutput>;
  searchMessages(
    request: TelegramSearchMessagesInput,
    options?: InternalRpcCallOptions
  ): Promise<TelegramSearchMessagesOutput>;
};

export type TelegramHistoryClient = {
  close?(): void;
  ensureHistoryCoverage(
    request: TelegramEnsureHistoryCoverageInput,
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
      return telegram.countMessagesInIntervals(
        request,
        callOptions
      ) as Promise<TelegramCountMessagesInIntervalsOutput>;
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
      return telegram.getChat(request, callOptions) as Promise<TelegramGetChatOutput>;
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
      return telegram.getMessage(request, callOptions) as Promise<TelegramGetMessageOutput>;
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
      return telegram.listRecentMessages(
        request,
        callOptions
      ) as Promise<TelegramListRecentMessagesOutput>;
    },
    searchMessages(request, callOptions) {
      return telegram.searchMessages(request, callOptions) as Promise<TelegramSearchMessagesOutput>;
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
      ) as Promise<TelegramCountMessagesInIntervalsOutput>;
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
      return clientFor('telegram.getChat').getChat(
        request,
        callOptions
      ) as Promise<TelegramGetChatOutput>;
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
      return clientFor('telegram.getMessage').getMessage(
        request,
        callOptions
      ) as Promise<TelegramGetMessageOutput>;
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
      ) as Promise<TelegramListRecentMessagesOutput>;
    },
    searchMessages(request, callOptions) {
      return clientFor('telegram.searchMessages').searchMessages(
        request,
        callOptions
      ) as Promise<TelegramSearchMessagesOutput>;
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
