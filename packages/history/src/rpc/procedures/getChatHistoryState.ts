import { query } from '@agentg/rpc/surface';
import { asc, eq } from 'drizzle-orm';

import { subtractIntervals } from '../../ranges.js';
import { projectTargetsForChat } from '../../reconciler.js';
import { historyTargets } from '../../schema.js';
import {
  historyChatHistoryStateOutputSchema,
  historyGetChatHistoryStateInputSchema
} from '../history-contracts.js';
import { runtimeForCall, type CreateHistoryRouterOptions } from '../runtime.js';
import { rpc } from '../trpc.js';
import {
  clipIntervalsForDisplay,
  currentHistoryProjectionContext,
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
      const [facts, telegramCoverage] = await Promise.all([
        telegram.getChatHistoryFacts({ chatId }),
        telegram.getHistoryCoverage({ chatId })
      ]);
      const chat = facts.chat;
      if (chat === null) {
        return {
          chat: null,
          coverage: [],
          desired: [],
          missing: [],
          targets: []
        };
      }

      const targetRows = await runtime.database
        .select()
        .from(historyTargets)
        .where(eq(historyTargets.telegramChatId, chatId))
        .orderBy(asc(historyTargets.id));

      const targetModels = targetRows.map(toHistoryTarget);
      const projectionContext = currentHistoryProjectionContext();
      const targets = targetRows.map((row) => toTargetResponse(row, projectionContext));
      const desired = projectTargetsForChat(targetModels, chatId, projectionContext);
      const coverage = telegramCoverage.coverage.map((interval) => ({
        coveredAt: interval.coveredAt,
        endAt: new Date(interval.endAt),
        startAt: new Date(interval.startAt)
      }));
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
          coveredAt: interval.coveredAt,
          messageCount: coverageMessageCounts.counts[index] ?? 0
        })),
        desired: displayedDesired.map(intervalToResponse),
        missing: displayedMissing.map(intervalToResponse),
        targets
      };
    })
);
