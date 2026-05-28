import { createTelegramRpcClient, type TelegramRpcClient } from '@agentg/telegram/rpc';
import type { InternalRpcCallOptions } from '@agentg/rpc/call-options';

import type { InternalTrpcClientConfig } from '@agentg/rpc/config';

type TelegramRpcProcedureName = Exclude<keyof TelegramRpcClient, 'close'>;

type TelegramRpcRequest<Name extends TelegramRpcProcedureName> = NonNullable<
  Parameters<TelegramRpcClient[Name]>[0]
>;
type TelegramRpcResult<Name extends TelegramRpcProcedureName> = Awaited<
  ReturnType<TelegramRpcClient[Name]>
>;

type CountMessagesInIntervalsResult = TelegramRpcResult<'countMessagesInIntervals'>;
type GetChatResult = TelegramRpcResult<'getChat'>;
type GetChatHistoryFactsResult = TelegramRpcResult<'getChatHistoryFacts'>;
type GetHistoryCoverageResult = TelegramRpcResult<'getHistoryCoverage'>;
type ListRecentMessagesRequest = TelegramRpcRequest<'listRecentMessages'>;
type ListRecentMessagesResult = TelegramRpcResult<'listRecentMessages'>;
type SearchMessagesRequest = TelegramRpcRequest<'searchMessages'>;
type SearchMessagesResult = TelegramRpcResult<'searchMessages'>;

export type TelegramHistoryChat = TelegramRpcResult<'listChats'>[number];
export type TelegramHistoryCoverageSegment =
  TelegramRpcResult<'getHistoryCoverage'>['coverage'][number];
export type TelegramHistoryFetchPageRequest = TelegramRpcRequest<'fetchPage'>;
export type TelegramHistoryFetchPageResult = TelegramRpcResult<'fetchPage'>;
export type TelegramHistoryInterval =
  TelegramRpcResult<'ensureHistoryCoverage'>['coveredIntervals'][number];
export type TelegramHistoryListChatsRequest = TelegramRpcRequest<'listChats'>;
export type TelegramReadChat = NonNullable<GetChatResult['chat']>;
export type TelegramReadMessage = ListRecentMessagesResult['messages'][number];
export type TelegramChatHistoryFacts = GetChatHistoryFactsResult;
export type TelegramEnsureHistoryCoverageResult = TelegramRpcResult<'ensureHistoryCoverage'>;
export type TelegramGetHistoryCoverageResult = GetHistoryCoverageResult;
export type TelegramMessageInterval = TelegramHistoryInterval;

export type TelegramReadClient = {
  countMessagesInIntervals(
    request: {
      chatId: string;
      intervals: TelegramMessageInterval[];
    },
    options?: InternalRpcCallOptions
  ): Promise<CountMessagesInIntervalsResult>;
  getChat(request: { chatId: string }, options?: InternalRpcCallOptions): Promise<GetChatResult>;
  getChatHistoryFacts(
    request: { chatId: string },
    options?: InternalRpcCallOptions
  ): Promise<TelegramChatHistoryFacts>;
  getHistoryCoverage(
    request: { chatId: string },
    options?: InternalRpcCallOptions
  ): Promise<TelegramGetHistoryCoverageResult>;
  listRecentMessages(
    request: ListRecentMessagesRequest,
    options?: InternalRpcCallOptions
  ): Promise<ListRecentMessagesResult>;
  searchMessages(
    request: SearchMessagesRequest,
    options?: InternalRpcCallOptions
  ): Promise<SearchMessagesResult>;
};

export type TelegramHistoryClient = {
  close?(): void;
  ensureHistoryCoverage(
    request: TelegramRpcRequest<'ensureHistoryCoverage'>,
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
      return telegram.countMessagesInIntervals(request, callOptions);
    },
    ensureHistoryCoverage(request, callOptions) {
      return telegram.ensureHistoryCoverage(request, callOptions);
    },
    fetchPage(request, callOptions) {
      return telegram.fetchPage(request, callOptions);
    },
    getChat(request, callOptions) {
      return telegram.getChat(request, callOptions);
    },
    getChatHistoryFacts(request, callOptions) {
      return telegram.getChatHistoryFacts(request, callOptions);
    },
    getHistoryCoverage(request, callOptions) {
      return telegram.getHistoryCoverage(request, callOptions);
    },
    listChats(request, callOptions) {
      return telegram.listChats(request, callOptions);
    },
    listRecentMessages(request, callOptions) {
      return telegram.listRecentMessages(request, callOptions);
    },
    searchMessages(request, callOptions) {
      return telegram.searchMessages(request, callOptions);
    }
  };
}

export function createServiceDirectoryTelegramHistoryClient(
  resolver: ServiceDirectoryProcedureResolver
): TelegramHistoryClient {
  const clients = new Map<string, TelegramRpcClient>();

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
      );
    },
    ensureHistoryCoverage(request, callOptions) {
      return clientFor('telegram.ensureHistoryCoverage').ensureHistoryCoverage(
        request,
        callOptions
      );
    },
    fetchPage(request, callOptions) {
      return clientFor('telegram.fetchPage').fetchPage(request, callOptions);
    },
    getChat(request, callOptions) {
      return clientFor('telegram.getChat').getChat(request, callOptions);
    },
    getChatHistoryFacts(request, callOptions) {
      return clientFor('telegram.getChatHistoryFacts').getChatHistoryFacts(request, callOptions);
    },
    getHistoryCoverage(request, callOptions) {
      return clientFor('telegram.getHistoryCoverage').getHistoryCoverage(request, callOptions);
    },
    listChats(request, callOptions) {
      return clientFor('telegram.listChats').listChats(request, callOptions);
    },
    listRecentMessages(request, callOptions) {
      return clientFor('telegram.listRecentMessages').listRecentMessages(request, callOptions);
    },
    searchMessages(request, callOptions) {
      return clientFor('telegram.searchMessages').searchMessages(request, callOptions);
    }
  };

  function clientFor(procedure: string): TelegramRpcClient {
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
