import { query } from '@agentg/rpc/surface';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { normalizeCoverageIntervals } from '../../coverage.js';
import { subtractIntervals } from '../../ranges.js';
import { projectTargetsForChat } from '../../reconciler.js';
import { historyBackfillJobs, historyCoverage, historyTargets } from '../../schema.js';
import {
  historyChatHistoryStateOutputSchema,
  historyGetChatHistoryStateInputSchema
} from '../history-contracts.js';
import { runtimeForCall, type CreateHistoryRouterOptions } from '../runtime.js';
import { rpc } from '../trpc.js';
import {
  activeBackfillJobStatuses,
  clipIntervalsForDisplay,
  currentHistoryProjectionContext,
  historyCoverageIntervals,
  intervalToResponse,
  isTelegramHistoryPastCovered,
  parseOptionalDate,
  requireTelegramReadClient,
  toHistoryTarget,
  toTargetResponse
} from './support.js';

export const getChatHistoryState = query((options: CreateHistoryRouterOptions) =>
  rpc
    .input(historyGetChatHistoryStateInputSchema)
    .output(historyChatHistoryStateOutputSchema)
    .query(async ({ ctx, input }) => {
      const runtime = runtimeForCall(options, ctx);
      const telegram = requireTelegramReadClient(runtime);
      const chatId = input.chatId;
      const facts = await telegram.getChatHistoryFacts({ chatId });
      const chat = facts.chat;
      if (chat === null) {
        return {
          chat: null,
          coverage: [],
          desired: [],
          jobs: [],
          missing: [],
          targets: []
        };
      }

      const [targetRows, coverageRows, jobRows] = await Promise.all([
        runtime.database
          .select()
          .from(historyTargets)
          .where(eq(historyTargets.telegramChatId, chatId))
          .orderBy(asc(historyTargets.id)),
        runtime.database
          .select()
          .from(historyCoverage)
          .where(eq(historyCoverage.telegramChatId, chatId))
          .orderBy(asc(historyCoverage.startAt)),
        runtime.database
          .select()
          .from(historyBackfillJobs)
          .where(
            and(
              eq(historyBackfillJobs.telegramChatId, chatId),
              inArray(historyBackfillJobs.status, activeBackfillJobStatuses)
            )
          )
          .orderBy(desc(historyBackfillJobs.endAt), desc(historyBackfillJobs.startAt))
          .limit(200)
      ]);

      const targetModels = targetRows.map(toHistoryTarget);
      const projectionContext = currentHistoryProjectionContext();
      const targets = targetRows.map((row) => toTargetResponse(row, projectionContext));
      const desired = projectTargetsForChat(targetModels, chatId, projectionContext);
      const coverage = normalizeCoverageIntervals(historyCoverageIntervals(coverageRows, chatId));
      const missing = subtractIntervals(desired, coverage);
      const historyBeginningReached = coverage.some(isTelegramHistoryPastCovered);
      const earliestMessageDate = parseOptionalDate(facts.earliestMessageDate);
      const historyStartAt =
        historyBeginningReached && earliestMessageDate !== undefined
          ? earliestMessageDate
          : undefined;
      const displayedDesired = clipIntervalsForDisplay(desired, historyStartAt);
      const displayedCoverage = clipIntervalsForDisplay(coverage, historyStartAt);
      const displayedMissing = clipIntervalsForDisplay(missing, historyStartAt);
      const coverageMessageCounts = await telegram.countMessagesInIntervals({
        chatId,
        intervals: displayedCoverage.map(intervalToResponse)
      });

      return {
        chat: {
          _model: 'telegram.chat',
          historyBeginningReached,
          historyStartAt: historyStartAt?.toISOString() ?? null,
          id: chat.id,
          isBot: chat.isBot,
          messageCount: facts.messageCount,
          title: chat.title,
          type: chat.type,
          updatedAt: chat.updatedAt
        },
        coverage: displayedCoverage.map((interval, index) => ({
          ...intervalToResponse(interval),
          messageCount: coverageMessageCounts.counts[index] ?? 0
        })),
        desired: displayedDesired.map(intervalToResponse),
        jobs: jobRows.map((job) => ({
          cursor: job.cursor,
          endAt: job.endAt.toISOString(),
          id: String(job.id),
          startAt: job.startAt.toISOString(),
          status: job.status,
          updatedAt: job.updatedAt.toISOString()
        })),
        missing: displayedMissing.map(intervalToResponse),
        targets
      };
    })
);
