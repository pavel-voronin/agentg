import type { HistoryBackfillJobInput } from './reconciler.js';

export type HistoryJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type HistoryJob = HistoryBackfillJobInput & {
  createdAt: string;
  id: number;
  status: HistoryJobStatus;
};
