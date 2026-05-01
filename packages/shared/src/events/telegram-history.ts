import type { JsonObject } from '../json.js';

export const TELEGRAM_HISTORY_LIST_CHATS_REQUESTED = 'agentg.command.telegram.history.list_chats';
export const TELEGRAM_HISTORY_FETCH_PAGE_REQUESTED = 'agentg.command.telegram.history.fetch_page';

export type TelegramHistoryChatListMode = 'archive' | 'main';

export type TelegramHistoryChat = {
  id: string;
  raw?: JsonObject;
  title: string;
  type: string;
};

export type TelegramHistoryListChatsRequest = {
  discover?: boolean;
  loadBatchSize?: number;
};

export type TelegramHistoryListChatsResult = {
  chats: TelegramHistoryChat[];
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
      kind: 'no_messages_before_end';
      fetchedMessages: 0;
      storedMessages: 0;
    }
  | {
      kind: 'anchor_before_start';
      anchorMessageDate: string;
      fetchedMessages: 0;
      storedMessages: 0;
    }
  | {
      kind: 'page';
      crossedStart: boolean;
      fetchedMessages: number;
      nextCursorMessageId?: number;
      oldestFetchedMessageDate?: string;
      reachedBeginning: boolean;
      storedMessages: number;
    };
