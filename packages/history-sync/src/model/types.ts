import type { JsonObject } from '@agentg/framework';

export type HistorySyncBoundary =
  | {
      at: string;
      kind: 'absolute';
    }
  | {
      expression: string;
      kind: 'expression';
    };

export type HistorySyncRange = {
  end: HistorySyncBoundary;
  start: HistorySyncBoundary;
};

export type HistorySyncInterval = {
  endAt: Date;
  startAt: Date;
};

export type HistorySyncTemplateMatch = {
  all?: boolean;
  chatType?: string | string[];
  titleIncludes?: string;
};

export type HistorySyncTemplate = {
  id: string;
  match: HistorySyncTemplateMatch;
  range: HistorySyncRange;
};

export type TelegramChatForHistorySync = {
  id: string;
  raw?: JsonObject;
  title: string;
  type: string;
};

export type HistorySyncTarget = {
  chatId: string;
  id: string;
  range: HistorySyncRange;
  templateId?: string;
};

export type TelegramHistoryChat = TelegramChatForHistorySync & {
  isBot?: boolean;
  updatedAt?: string;
};

export type TelegramHistoryIntervalOutput = {
  endAt: string;
  startAt: string;
};

export type TelegramEnsureHistoryCoverageResult = {
  alreadyCovered: boolean;
  coveredIntervals: TelegramHistoryIntervalOutput[];
  fetchedMessages: number;
  pages: number;
  remainingIntervals: TelegramHistoryIntervalOutput[];
  reachedBeginning: boolean;
  storedMessages: number;
};

export type TelegramHistoryCoverageResult = {
  coverage: {
    coveredAt: string;
    endAt: string;
    startAt: string;
  }[];
};

export type TelegramChatHistoryFacts = {
  chat: {
    _model: 'telegram.chat';
    id: string;
    isBot: boolean;
    title: string;
    type: string;
    updatedAt: string;
  } | null;
  earliestMessageDate: string | null;
  messageCount: number;
};

export type TelegramHistoryClient = {
  countMessagesInIntervals(request: {
    chatId: string;
    intervals: TelegramHistoryIntervalOutput[];
  }): Promise<{ counts: number[] }>;
  ensureHistoryCoverage(request: {
    chatId: string;
    endAt: string;
    limit?: number;
    maxPages?: number;
    requestDelayMs?: number;
    startAt: string;
  }): Promise<TelegramEnsureHistoryCoverageResult>;
  getChatHistoryFacts(request: { chatId: string }): Promise<TelegramChatHistoryFacts>;
  getHistoryCoverage(request: { chatId: string }): Promise<TelegramHistoryCoverageResult>;
  listChats(request: {
    discover?: boolean;
    loadBatchSize?: number;
  }): Promise<TelegramHistoryChat[]>;
};
