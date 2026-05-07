import { query } from '@agentg/rpc/surface';
import { and, inArray } from 'drizzle-orm';

import { historyBackfillJobs, historyCoverage, historyTargets } from '../../schema.js';
import {
  historyGetChatStatsInputSchema,
  historyGetChatStatsOutputSchema
} from '../history-contracts.js';
import { runtimeForCall, type CreateHistoryRouterOptions } from '../runtime.js';
import { rpc } from '../trpc.js';
import {
  activeBackfillJobStatuses,
  countBy,
  groupBy,
  maxOptionalDate,
  minOptionalDate
} from './support.js';

export const getChatStats = query((options: CreateHistoryRouterOptions) =>
  rpc
    .input(historyGetChatStatsInputSchema)
    .output(historyGetChatStatsOutputSchema)
    .query(async ({ ctx, input }) => {
      const runtime = runtimeForCall(options, ctx);
      const chatIds = [...new Set(input.chatIds)];
      const [targets, coverage, jobs] =
        chatIds.length === 0
          ? [[], [], []]
          : await Promise.all([
              runtime.database
                .select({
                  telegramChatId: historyTargets.telegramChatId
                })
                .from(historyTargets)
                .where(inArray(historyTargets.telegramChatId, chatIds)),
              runtime.database
                .select({
                  endAt: historyCoverage.endAt,
                  startAt: historyCoverage.startAt,
                  telegramChatId: historyCoverage.telegramChatId
                })
                .from(historyCoverage)
                .where(inArray(historyCoverage.telegramChatId, chatIds)),
              runtime.database
                .select({
                  status: historyBackfillJobs.status,
                  telegramChatId: historyBackfillJobs.telegramChatId
                })
                .from(historyBackfillJobs)
                .where(
                  and(
                    inArray(historyBackfillJobs.telegramChatId, chatIds),
                    inArray(historyBackfillJobs.status, activeBackfillJobStatuses)
                  )
                )
            ]);

      const targetsByChat = countBy(targets, (target) => target.telegramChatId);
      const jobsByChat = groupBy(jobs, (job) => job.telegramChatId);
      const coverageByChat = groupBy(coverage, (interval) => interval.telegramChatId);

      return {
        stats: chatIds.map((chatId) => {
          const chatCoverage = coverageByChat.get(chatId) ?? [];
          const chatJobs = jobsByChat.get(chatId) ?? [];
          const jobCounts = countBy(chatJobs, (job) => job.status);

          return {
            chatId,
            coverageIntervals: chatCoverage.length,
            coverageNewestAt: maxOptionalDate(chatCoverage.map((interval) => interval.endAt)),
            coverageOldestAt: minOptionalDate(chatCoverage.map((interval) => interval.startAt)),
            pendingJobs: jobCounts.pending ?? 0,
            runningJobs: jobCounts.running ?? 0,
            targets: targetsByChat[chatId] ?? 0
          };
        })
      };
    })
);
