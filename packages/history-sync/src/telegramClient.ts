import {
  createTelegramRpcClient,
  type TelegramCountMessagesInIntervalsOutput,
  type TelegramEnsureHistoryCoverageInput,
  type TelegramEnsureHistoryCoverageOutput,
  type TelegramGetChatHistoryFactsOutput,
  type TelegramGetChatOutput,
  type TelegramGetHistoryCoverageOutput,
  type TelegramHistoryChat,
  type TelegramHistoryCoverageSegment,
  type TelegramHistoryFetchPageRequest,
  type TelegramHistoryFetchPageResult,
  type TelegramHistoryInterval,
  type TelegramHistoryListChatsRequest,
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
  TelegramHistoryChat,
  TelegramHistoryCoverageSegment,
  TelegramHistoryFetchPageRequest,
  TelegramHistoryFetchPageResult,
  TelegramHistoryInterval,
  TelegramHistoryListChatsRequest,
  TelegramReadChat,
  TelegramReadMessage
};

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
