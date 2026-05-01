import {
  TelegramHistoryFetchPageKind,
  TelegramHistoryServiceClient,
  type TelegramHistoryFetchPageResponse,
  type TelegramHistoryListChatsResponse
} from '@agentg/proto/agentg/telegram/v1/history';
import {
  grpcTargetFromInternalRpcUrl,
  type InternalRpcClientConfig
} from '@agentg/proto/rpc/config';
import {
  createInsecureInternalRpcCredentials,
  createInternalRpcCallOptions,
  createInternalRpcMetadata
} from '@agentg/proto/rpc/grpc';
import type { ServiceError } from '@grpc/grpc-js';

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

export function createGrpcTelegramHistoryClient(
  config: InternalRpcClientConfig
): TelegramHistoryClient {
  const client = new TelegramHistoryServiceClient(
    grpcTargetFromInternalRpcUrl(config.url, 'TELEGRAM_RPC_URL'),
    createInsecureInternalRpcCredentials()
  );

  return {
    close() {
      client.close();
    },
    async fetchPage(request) {
      const response = await fetchPage(client, request);
      return parseFetchPageResult(response);
    },
    async listChats(request) {
      const response = await listChats(client, request);
      return response.chats;
    }
  };
}

function listChats(
  client: TelegramHistoryServiceClient,
  request: TelegramHistoryListChatsRequest
): Promise<TelegramHistoryListChatsResponse> {
  return new Promise((resolve, reject) => {
    client.listChats(
      {
        discover: request.discover === true,
        loadBatchSize: request.loadBatchSize ?? 0
      },
      createInternalRpcMetadata(),
      createInternalRpcCallOptions(TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS),
      (error, response) => completeUnary(error, response, resolve, reject)
    );
  });
}

function fetchPage(
  client: TelegramHistoryServiceClient,
  request: TelegramHistoryFetchPageRequest
): Promise<TelegramHistoryFetchPageResponse> {
  return new Promise((resolve, reject) => {
    client.fetchPage(
      {
        chatId: request.chatId,
        cursorMessageId:
          request.cursorMessageId === undefined ? '' : String(request.cursorMessageId),
        endAt: request.endAt,
        limit: request.limit,
        startAt: request.startAt
      },
      createInternalRpcMetadata(),
      createInternalRpcCallOptions(TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS),
      (error, response) => completeUnary(error, response, resolve, reject)
    );
  });
}

function completeUnary<Response>(
  error: ServiceError | null,
  response: Response,
  resolve: (response: Response) => void,
  reject: (error: unknown) => void
): void {
  if (error !== null) {
    reject(error);
    return;
  }

  resolve(response);
}

function parseFetchPageResult(
  result: TelegramHistoryFetchPageResponse
): TelegramHistoryFetchPageResult {
  switch (result.kind) {
    case TelegramHistoryFetchPageKind.TELEGRAM_HISTORY_FETCH_PAGE_KIND_NO_MESSAGES_BEFORE_END:
      return {
        fetchedMessages: 0,
        kind: 'no_messages_before_end',
        storedMessages: 0
      };
    case TelegramHistoryFetchPageKind.TELEGRAM_HISTORY_FETCH_PAGE_KIND_ANCHOR_BEFORE_START:
      return {
        anchorMessageDate: requireString(
          result.anchorMessageDate,
          'TelegramHistory.FetchPage response requires anchorMessageDate'
        ),
        fetchedMessages: 0,
        kind: 'anchor_before_start',
        storedMessages: 0
      };
    case TelegramHistoryFetchPageKind.TELEGRAM_HISTORY_FETCH_PAGE_KIND_PAGE: {
      const nextCursorMessageId = optionalSafeIntegerText(result.nextCursorMessageId);
      const oldestFetchedMessageDate = optionalString(result.oldestFetchedMessageDate);
      return {
        crossedStart: result.crossedStart,
        fetchedMessages: result.fetchedMessages,
        kind: 'page',
        ...(nextCursorMessageId === undefined ? {} : { nextCursorMessageId }),
        ...(oldestFetchedMessageDate === undefined ? {} : { oldestFetchedMessageDate }),
        reachedBeginning: result.reachedBeginning,
        storedMessages: result.storedMessages
      };
    }
    case TelegramHistoryFetchPageKind.TELEGRAM_HISTORY_FETCH_PAGE_KIND_UNSPECIFIED:
    case TelegramHistoryFetchPageKind.UNRECOGNIZED:
      throw new Error('Invalid TelegramHistory.FetchPage response kind');
  }
}

function requireString(value: string, message: string): string {
  const parsed = optionalString(value);
  if (parsed === undefined) {
    throw new Error(message);
  }
  return parsed;
}

function optionalString(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function optionalSafeIntegerText(value: string): number | undefined {
  if (value.length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
