import type { JsonObject } from '@agentg/events/json';

export type HistoryBoundary =
  | {
      at: string;
      kind: 'absolute';
    }
  | {
      expression: string;
      kind: 'expression';
    };

export type HistoryRange = {
  end: HistoryBoundary;
  start: HistoryBoundary;
};

export type HistoryInterval = {
  endAt: Date;
  startAt: Date;
};

export type HistoryTemplateMatch = {
  all?: boolean;
  chatType?: string | string[];
  titleIncludes?: string;
};

export type HistoryTemplate = {
  id: string;
  match: HistoryTemplateMatch;
  range: HistoryRange;
};

export type TelegramChatForHistory = {
  id: string;
  raw?: JsonObject;
  title: string;
  type: string;
};

export type HistoryTarget = {
  chatId: string;
  id: string;
  range: HistoryRange;
  templateId?: string;
};

export type HistoryCoverageInterval = HistoryInterval & {
  chatId: string;
};

export type BackfillJobStatus = 'pending' | 'running';

export type BackfillJob = HistoryInterval & {
  chatId: string;
  cursor?: JsonObject;
  id: string;
  status: BackfillJobStatus;
};

export type BackfillJobInput = HistoryInterval & {
  chatId: string;
};
