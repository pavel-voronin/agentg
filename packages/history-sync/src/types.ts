import type { JsonObject } from '@agentg/events/json';

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
