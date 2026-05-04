import type { HistoryBackfillJobInput } from './reconciler.js';
import {
  floorToTelegramSecond,
  normalizeHistoryInterval,
  TELEGRAM_HISTORY_TICK_MS
} from './ranges.js';

export const TELEGRAM_HISTORY_PAST_BOUNDARY = new Date('2013-08-14T00:00:00.000Z');

export type HistoryJobCursor = Record<string, unknown>;

export type HistoryJobStatus = 'queued' | 'running';

export type HistoryJob = HistoryBackfillJobInput & {
  createdAt: string;
  id: number;
  status: HistoryJobStatus;
  updatedAt: string;
  cursor?: HistoryJobCursor;
};

export type BackfillPageCheckpointInput = {
  crossedStart: boolean;
  reachedBeginning: boolean;
  remainingEndAt: Date;
  oldestFetchedMessageDate?: Date;
};

export type BackfillPageCheckpoint = {
  complete: boolean;
  remainingEndAt: Date;
  coveredInterval?: HistoryBackfillJobInput;
};

export function checkpointBackfillPage(
  job: HistoryJob,
  checkpoint: BackfillPageCheckpointInput
): BackfillPageCheckpoint {
  const remainingEndAt = normalizeHistoryInterval({
    endAt: checkpoint.remainingEndAt,
    startAt: job.startAt
  }).endAt;
  const coveredStartAt = checkpointCoveredStartAt(job, checkpoint, remainingEndAt);
  const coveredInterval =
    coveredStartAt === undefined || coveredStartAt >= remainingEndAt
      ? undefined
      : {
          chatId: job.chatId,
          endAt: remainingEndAt,
          startAt: coveredStartAt
        };

  return {
    complete: checkpoint.crossedStart || checkpoint.reachedBeginning,
    ...(coveredInterval === undefined ? {} : { coveredInterval }),
    remainingEndAt:
      coveredInterval === undefined || checkpoint.crossedStart || checkpoint.reachedBeginning
        ? remainingEndAt
        : coveredInterval.startAt
  };
}

function checkpointCoveredStartAt(
  job: HistoryJob,
  checkpoint: BackfillPageCheckpointInput,
  remainingEndAt: Date
): Date | undefined {
  if (checkpoint.reachedBeginning) {
    return TELEGRAM_HISTORY_PAST_BOUNDARY;
  }

  if (checkpoint.crossedStart) {
    return job.startAt;
  }

  if (checkpoint.oldestFetchedMessageDate === undefined) {
    return undefined;
  }

  const oldestFetchedSecond = floorToTelegramSecond(checkpoint.oldestFetchedMessageDate);
  const nextUnprovenEndAt = new Date(oldestFetchedSecond.getTime() + TELEGRAM_HISTORY_TICK_MS);
  return nextUnprovenEndAt < remainingEndAt ? nextUnprovenEndAt : undefined;
}
