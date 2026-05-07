import { query } from '@agentg/rpc/surface';
import { desc, eq, inArray } from 'drizzle-orm';

import { historyBackfillJobs } from '../../schema.js';
import { historyListJobsInputSchema, historyListJobsOutputSchema } from '../history-contracts.js';
import { runtimeForCall, type CreateHistoryRouterOptions } from '../runtime.js';
import { rpc } from '../trpc.js';
import { activeBackfillJobStatuses } from './support.js';

export const listJobs = query((options: CreateHistoryRouterOptions) =>
  rpc
    .input(historyListJobsInputSchema)
    .output(historyListJobsOutputSchema)
    .query(async ({ ctx, input }) => {
      const runtime = runtimeForCall(options, ctx);
      const status = input.status;
      const limit = Math.min(input.limit ?? 100, 500);
      if (status !== undefined && !activeBackfillJobStatuses.includes(status)) {
        return { jobs: [] };
      }

      const where =
        status === undefined
          ? inArray(historyBackfillJobs.status, activeBackfillJobStatuses)
          : eq(historyBackfillJobs.status, status);
      const rows = await runtime.database
        .select()
        .from(historyBackfillJobs)
        .where(where)
        .orderBy(desc(historyBackfillJobs.endAt), desc(historyBackfillJobs.startAt))
        .limit(limit);

      return {
        jobs: rows.map((job) => ({
          cursor: job.cursor,
          endAt: job.endAt.toISOString(),
          id: String(job.id),
          startAt: job.startAt.toISOString(),
          status: job.status,
          telegramChatId: job.telegramChatId,
          updatedAt: job.updatedAt.toISOString()
        }))
      };
    })
);
