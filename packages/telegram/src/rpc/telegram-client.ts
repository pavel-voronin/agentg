import { createTRPCClient, httpBatchLink } from '@trpc/client';
import {
  createInternalRpcCallOptionsHeaders,
  internalRpcProcedureOptions,
  type InternalRpcCallOptions
} from '@agentg/shared/rpc/call-options';

import {
  telegramCountMessagesInIntervalsInputSchema,
  telegramGetChatHistoryFactsInputSchema,
  telegramGetChatInputSchema,
  telegramGetMessageInputSchema,
  telegramHistoryFetchPageInputSchema,
  telegramHistoryListChatsInputSchema,
  telegramListChatDirectoryInputSchema,
  telegramListRecentMessagesInputSchema,
  telegramSearchMessagesInputSchema,
  type TelegramHistoryRouter
} from './history-router.js';

type TelegramRpcClientConfig = {
  url: string;
};

type TelegramRpcClientOptions = {
  timeoutMs?: number;
};

type TelegramRpcClient = {
  close(): void;
  countMessagesInIntervals(input: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  fetchPage(input: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  getChat(input: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  getChatHistoryFacts(input: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  getMessage(input: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  listChatDirectory(input?: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  listChats(input?: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  listRecentMessages(input?: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
  searchMessages(input: unknown, options?: InternalRpcCallOptions): Promise<unknown>;
};

const TELEGRAM_REQUEST_TIMEOUT_MS = 15000;

export function createTelegramRpcClient(
  config: TelegramRpcClientConfig,
  options: TelegramRpcClientOptions = {}
): TelegramRpcClient {
  const client = createTRPCClient<TelegramHistoryRouter>({
    links: [
      httpBatchLink({
        headers: ({ opList }) => createInternalRpcCallOptionsHeaders(opList),
        url: parseTelegramRpcUrl(config.url)
      })
    ]
  });
  const timeoutMs = options.timeoutMs ?? TELEGRAM_REQUEST_TIMEOUT_MS;

  return {
    close() {
      return;
    },
    countMessagesInIntervals(input, callOptions) {
      return callTelegramProcedure(
        (signal) =>
          client.countMessagesInIntervals.query(
            telegramCountMessagesInIntervalsInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    },
    fetchPage(input, callOptions) {
      return callTelegramProcedure(
        (signal) =>
          client.fetchPage.mutate(
            telegramHistoryFetchPageInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    },
    getChat(input, callOptions) {
      return callTelegramProcedure(
        (signal) =>
          client.getChat.query(
            telegramGetChatInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    },
    getChatHistoryFacts(input, callOptions) {
      return callTelegramProcedure(
        (signal) =>
          client.getChatHistoryFacts.query(
            telegramGetChatHistoryFactsInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    },
    getMessage(input, callOptions) {
      return callTelegramProcedure(
        (signal) =>
          client.getMessage.query(
            telegramGetMessageInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    },
    listChatDirectory(input = {}, callOptions) {
      return callTelegramProcedure(
        (signal) =>
          client.listChatDirectory.query(
            telegramListChatDirectoryInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    },
    listChats(input = {}, callOptions) {
      return callTelegramProcedure(
        (signal) =>
          client.listChats.query(
            telegramHistoryListChatsInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    },
    listRecentMessages(input = {}, callOptions) {
      return callTelegramProcedure(
        (signal) =>
          client.listRecentMessages.query(
            telegramListRecentMessagesInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    },
    searchMessages(input, callOptions) {
      return callTelegramProcedure(
        (signal) =>
          client.searchMessages.query(
            telegramSearchMessagesInputSchema.parse(input),
            internalRpcProcedureOptions(callOptions, signal)
          ),
        timeoutMs
      );
    }
  };
}

async function callTelegramProcedure<T>(
  call: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Telegram tRPC timed out after ${String(timeoutMs)}ms`));
  }, timeoutMs);
  timeout.unref();

  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function parseTelegramRpcUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch (error) {
    throw new Error('Telegram RPC URL must be a valid http(s) URL', { cause: error });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Telegram RPC URL must use http or https');
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error('Telegram RPC URL must not include credentials');
  }

  if (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0) {
    throw new Error('Telegram RPC URL must point to a service root');
  }

  return url.toString().replace(/\/$/, '');
}
