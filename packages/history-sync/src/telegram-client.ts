import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { TelegramHistoryRouter } from '@agentg/telegram/rpc';

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

export type TelegramHistoryClient = {
  close?(): void;
  fetchPage(request: TelegramHistoryFetchPageRequest): Promise<TelegramHistoryFetchPageResult>;
  listChats(request: TelegramHistoryListChatsRequest): Promise<TelegramHistoryChat[]>;
};

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
    fetchPage(request) {
      return withTimeout(
        (signal) => client.fetchPage.mutate(request, { signal }),
        TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
      );
    },
    listChats(request) {
      return withTimeout(
        (signal) => client.listChats.query(request, { signal }),
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
