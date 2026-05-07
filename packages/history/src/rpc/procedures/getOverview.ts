import { query } from '@agentg/rpc/surface';
import { desc, inArray } from 'drizzle-orm';

import {
  historyBackfillJobs,
  historyCoverage,
  historyTargets,
  historyTemplates
} from '../../schema.js';
import {
  historyGetOverviewInputSchema,
  historyOverviewOutputSchema
} from '../history-contracts.js';
import { runtimeForCall, type CreateHistoryRouterOptions } from '../runtime.js';
import { rpc } from '../trpc.js';
import { activeBackfillJobStatuses, countBy } from './support.js';

export const getOverview = query((options: CreateHistoryRouterOptions) =>
  rpc
    .input(historyGetOverviewInputSchema)
    .output(historyOverviewOutputSchema)
    .query(async ({ ctx }) => {
      const runtime = runtimeForCall(options, ctx);
      const [templates, targets, coverage, activeJobs] = await Promise.all([
        runtime.database.select({ id: historyTemplates.id }).from(historyTemplates),
        runtime.database.select({ id: historyTargets.id }).from(historyTargets),
        runtime.database.select({ id: historyCoverage.id }).from(historyCoverage),
        runtime.database
          .select({
            endAt: historyBackfillJobs.endAt,
            startAt: historyBackfillJobs.startAt,
            status: historyBackfillJobs.status,
            telegramChatId: historyBackfillJobs.telegramChatId
          })
          .from(historyBackfillJobs)
          .where(inArray(historyBackfillJobs.status, activeBackfillJobStatuses))
          .orderBy(
            desc(historyBackfillJobs.status),
            desc(historyBackfillJobs.endAt),
            desc(historyBackfillJobs.startAt)
          )
          .limit(1)
      ]);
      const jobs = await runtime.database
        .select({
          status: historyBackfillJobs.status
        })
        .from(historyBackfillJobs)
        .where(inArray(historyBackfillJobs.status, activeBackfillJobStatuses));
      const jobCounts = countBy(jobs, (job) => job.status);
      const activeJob = activeJobs[0];

      return {
        activeJob:
          activeJob === undefined
            ? null
            : {
                chatId: activeJob.telegramChatId,
                endAt: activeJob.endAt.toISOString(),
                startAt: activeJob.startAt.toISOString(),
                status: activeJob.status
              },
        coverageIntervals: coverage.length,
        pendingJobs: jobCounts.pending ?? 0,
        runningJobs: jobCounts.running ?? 0,
        targets: targets.length,
        templates: templates.length
      };
    })
);
