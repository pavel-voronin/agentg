import { createTRPCClient, httpBatchLink } from '@trpc/client';
import {
  createInternalRpcCallOptionsHeaders,
  internalRpcProcedureOptions,
  type InternalRpcCallOptions
} from '@agentg/shared/rpc/call-options';
import type {
  TelegramChatDirectoryEntry,
  TelegramChatFolder,
  TelegramChatTypeCount,
  TelegramHistoryRouter,
  TelegramReadChat,
  TelegramReadMessage
} from '@agentg/telegram/rpc';

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

export type TelegramMessageInterval = {
  endAt: string;
  startAt: string;
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
  fetchPage(
    request: TelegramHistoryFetchPageRequest,
    options?: InternalRpcCallOptions
  ): Promise<TelegramHistoryFetchPageResult>;
  listChats(
    request: TelegramHistoryListChatsRequest,
    options?: InternalRpcCallOptions
  ): Promise<TelegramHistoryChat[]>;
} & TelegramReadClient;

const TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS = 30000;

export function createTrpcTelegramHistoryClient(
  config: InternalTrpcClientConfig
): TelegramHistoryClient {
  const client = createTRPCClient<TelegramHistoryRouter>({
    links: [
      httpBatchLink({
        headers: ({ opList }) => createInternalRpcCallOptionsHeaders(opList),
        url: config.url
      })
    ]
  });

  return {
    close() {
      return;
    },
    countMessagesInIntervals(request, callOptions) {
      return withTimeout(
        async (signal) =>
          client.countMessagesInIntervals.query(
            request,
            internalRpcProcedureOptions(callOptions, signal)
          ),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    fetchPage(request, callOptions) {
      return withTimeout(
        async (signal) =>
          client.fetchPage.mutate(request, internalRpcProcedureOptions(callOptions, signal)),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    getChat(request, callOptions) {
      return withTimeout(
        async (signal) =>
          client.getChat.query(request, internalRpcProcedureOptions(callOptions, signal)),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    getChatHistoryFacts(request, callOptions) {
      return withTimeout(
        async (signal) =>
          client.getChatHistoryFacts.query(
            request,
            internalRpcProcedureOptions(callOptions, signal)
          ),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    getMessage(request, callOptions) {
      return withTimeout(
        async (signal) =>
          client.getMessage.query(request, internalRpcProcedureOptions(callOptions, signal)),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    listChatDirectory(request, callOptions) {
      return withTimeout(
        async (signal) =>
          client.listChatDirectory.query(request, internalRpcProcedureOptions(callOptions, signal)),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    listChats(request, callOptions) {
      return withTimeout(
        async (signal) =>
          client.listChats.query(request, internalRpcProcedureOptions(callOptions, signal)),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    listRecentMessages(request, callOptions) {
      return withTimeout(
        async (signal) =>
          client.listRecentMessages.query(
            request,
            internalRpcProcedureOptions(callOptions, signal)
          ),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    searchMessages(request, callOptions) {
      return withTimeout(
        async (signal) =>
          client.searchMessages.query(request, internalRpcProcedureOptions(callOptions, signal)),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    }
  };
}

async function withTimeout<T>(
  call: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Telegram History tRPC timed out after ${String(timeoutMs)}ms`));
  }, timeoutMs);
  timeout.unref();

  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
