import type { JsonObject } from '../../bus/events.js';

export type SummaryRunStatus = 'completed' | 'failed' | 'pending' | 'running';

export type SummarySourceReference = {
  messageDate: string | null;
  messageId: string;
};

export type SummaryResult = {
  chatId: string;
  createdAt: string;
  id: number;
  runId: string;
  sourceReferences: SummarySourceReference[];
  summary: string;
  updatedAt: string;
};

export type SummaryRun = {
  chatId: string;
  completedAt: string | null;
  error: JsonObject | null;
  failedAt: string | null;
  id: string;
  reason: string | null;
  requestedAt: string;
  startedAt: string | null;
  status: SummaryRunStatus;
  updatedAt: string;
};

export type SummaryInvalidation = {
  chatId: string;
  eventId: string | null;
  invalidatedAt: string;
  reason: string;
  updatedAt: string;
};

export type SummaryRequest = {
  chatId: string;
  reason?: string;
};

export type SummaryRequestResult = {
  run: SummaryRun;
  summary: SummaryResult;
};

export type SummaryReadResult = {
  invalidation: SummaryInvalidation | null;
  summary: SummaryResult | null;
};
