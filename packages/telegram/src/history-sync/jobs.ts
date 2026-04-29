import type { JsonObject } from '@agentg/shared/json';

import { addCoverageInterval } from './coverage.js';
import { orderIntervalsClosestToPresent } from './ranges.js';
import { normalizeTelegramHistoryInterval } from './time.js';
import type { BackfillJob, HistoryCoverageInterval } from './types.js';

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

export async function completeBackfillJobAfterPersistingMessages(
  job: BackfillJob,
  messages: unknown[],
  persistMessages: (messages: unknown[]) => Promise<void>,
  addCoverage: (job: BackfillJob) => Promise<void>
): Promise<void> {
  await persistMessages(messages);
  await addCoverage(job);
}
