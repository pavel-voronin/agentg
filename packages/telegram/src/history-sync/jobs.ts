import type { JsonObject } from '@agentg/shared/json';

import { TELEGRAM_HISTORY_PAST_BOUNDARY } from './constants.js';
import { addCoverageInterval } from './coverage.js';
import { orderIntervalsClosestToPresent } from './ranges.js';
import {
  floorToTelegramSecond,
  normalizeTelegramHistoryInterval,
  TELEGRAM_HISTORY_TICK_MS
} from './time.js';
import type { BackfillJob, HistoryCoverageInterval } from './types.js';

export type BackfillPageCheckpointInput = {
  crossedStart: boolean;
  oldestFetchedMessageDate?: Date;
  reachedBeginning: boolean;
  remainingEndAt: Date;
};

export type BackfillPageCheckpoint = {
  complete: boolean;
  coveredInterval?: HistoryCoverageInterval;
  remainingEndAt: Date;
};

export function claimNextBackfillJob(jobs: BackfillJob[]): BackfillJob | undefined {
  const job = orderIntervalsClosestToPresent(
    jobs.filter((candidate) => candidate.status === 'pending')
  )[0] as BackfillJob | undefined;
  return job === undefined ? undefined : normalizeTelegramHistoryInterval(job);
}

export function updateBackfillJobCursor(job: BackfillJob, cursor: JsonObject): BackfillJob {
  return {
    ...job,
    cursor,
    status: 'running'
  };
}

export function completeBackfillJob(
  job: BackfillJob,
  coverage: HistoryCoverageInterval[]
): {
  coverage: HistoryCoverageInterval[];
} {
  return {
    coverage: addCoverageInterval(coverage, {
      ...normalizeTelegramHistoryInterval({
        chatId: job.chatId,
        endAt: job.endAt,
        startAt: job.startAt
      })
    })
  };
}

export function checkpointBackfillPage(
  job: BackfillJob,
  checkpoint: BackfillPageCheckpointInput
): BackfillPageCheckpoint {
  const remainingEndAt = normalizeTelegramHistoryInterval({
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

export async function completeBackfillJobAfterPersistingMessages(
  job: BackfillJob,
  messages: unknown[],
  persistMessages: (messages: unknown[]) => Promise<void>,
  addCoverage: (job: BackfillJob) => Promise<void>
): Promise<void> {
  await persistMessages(messages);
  await addCoverage(job);
}

function checkpointCoveredStartAt(
  job: BackfillJob,
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
