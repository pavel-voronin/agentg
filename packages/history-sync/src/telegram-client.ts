import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { unwrapProcedureEnvelope } from '@agentg/shared/rpc/envelope';
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
  countMessagesInIntervals(request: {
    chatId: string;
    intervals: TelegramMessageInterval[];
  }): Promise<{ counts: number[] }>;
  getChat(request: { chatId: string }): Promise<{ chat: TelegramReadChat | null }>;
  getChatHistoryFacts(request: { chatId: string }): Promise<TelegramChatHistoryFacts>;
  getMessage(request: {
    chatId: string;
    messageId: string;
  }): Promise<{ message: TelegramReadMessage | null }>;
  listChatDirectory(request: TelegramChatDirectoryRequest): Promise<TelegramChatDirectoryResult>;
  listRecentMessages(request: {
    chatId?: string;
    limit?: number;
  }): Promise<{ messages: TelegramReadMessage[] }>;
  searchMessages(request: {
    chatId?: string;
    limit?: number;
    query: string;
  }): Promise<{ messages: TelegramReadMessage[] }>;
};

export type TelegramHistoryClient = {
  close?(): void;
  fetchPage(request: TelegramHistoryFetchPageRequest): Promise<TelegramHistoryFetchPageResult>;
  listChats(request: TelegramHistoryListChatsRequest): Promise<TelegramHistoryChat[]>;
} & TelegramReadClient;

const TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS = 30000;

export function createTrpcTelegramHistoryClient(
  config: InternalTrpcClientConfig
): TelegramHistoryClient {
  const client = createTRPCClient<TelegramHistoryRouter>({
    links: [
      httpBatchLink({
        url: config.url
      })
    ]
  });

  return {
    close() {
      return;
    },
    countMessagesInIntervals(request) {
      return withTimeout(
        async (signal) =>
          unwrapProcedureEnvelope(await client.countMessagesInIntervals.query(request, { signal })),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    fetchPage(request) {
      return withTimeout(
        async (signal) =>
          unwrapProcedureEnvelope(await client.fetchPage.mutate(request, { signal })),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    getChat(request) {
      return withTimeout(
        async (signal) => unwrapProcedureEnvelope(await client.getChat.query(request, { signal })),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    getChatHistoryFacts(request) {
      return withTimeout(
        async (signal) =>
          unwrapProcedureEnvelope(await client.getChatHistoryFacts.query(request, { signal })),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    getMessage(request) {
      return withTimeout(
        async (signal) =>
          unwrapProcedureEnvelope(await client.getMessage.query(request, { signal })),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    listChatDirectory(request) {
      return withTimeout(
        async (signal) =>
          unwrapProcedureEnvelope(await client.listChatDirectory.query(request, { signal })),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    listChats(request) {
      return withTimeout(
        async (signal) =>
          unwrapProcedureEnvelope(await client.listChats.query(request, { signal })),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    listRecentMessages(request) {
      return withTimeout(
        async (signal) =>
          unwrapProcedureEnvelope(await client.listRecentMessages.query(request, { signal })),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    searchMessages(request) {
      return withTimeout(
        async (signal) =>
          unwrapProcedureEnvelope(await client.searchMessages.query(request, { signal })),
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
