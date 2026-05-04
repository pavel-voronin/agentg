import { createTelegramRpcClient } from '@agentg/telegram/rpc';
import type { InternalRpcCallOptions } from '@agentg/shared/rpc/call-options';

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

export type TelegramReadChat = {
  _model: 'telegram.chat';
  id: string;
  title: string;
  type: string;
  updatedAt: string;
};

export type TelegramReadMessage = {
  chatId: string;
  contentType: string;
  deletedAt: string | null;
  editDate: string | null;
  isDeleted: boolean;
  messageDate: string | null;
  messageId: string;
  senderId: string | null;
  senderType: string | null;
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
  iconName: string | null;
  id: number;
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
  const telegram = createTelegramRpcClient(config, {
    timeoutMs: TELEGRAM_HISTORY_REQUEST_TIMEOUT_MS
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
