import { query } from '@agentg/rpc/surface';
import { asc, eq } from 'drizzle-orm';

import { subtractIntervals } from '../../ranges.js';
import { projectTargetsForChat } from '../../reconciler.js';
import { historySyncTargets } from '../../schema.js';
import {
  historySyncChatHistorySyncStateOutputSchema,
  historySyncGetChatHistorySyncStateInputSchema
} from '../historySyncContracts.js';
import { runtimeForCall, type CreateHistorySyncRouterOptions } from '../runtime.js';
import { rpc } from '../trpc.js';
import {
  clipIntervalsForDisplay,
  currentHistorySyncProjectionContext,
  intervalToResponse,
  isTelegramHistoryPastCovered,
  parseOptionalDate,
  requireTelegramReadClient,
  toHistorySyncTarget,
  toTargetResponse
} from './support.js';

export const getChatHistorySyncState = query((options: CreateHistorySyncRouterOptions) =>
  rpc
    .input(historySyncGetChatHistorySyncStateInputSchema)
    .output(historySyncChatHistorySyncStateOutputSchema)
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
        .from(historySyncTargets)
        .where(eq(historySyncTargets.telegramChatId, chatId))
        .orderBy(asc(historySyncTargets.id));

      const targetModels = targetRows.map(toHistorySyncTarget);
      const projectionContext = currentHistorySyncProjectionContext();
      const targets = targetRows.map((row) => toTargetResponse(row, projectionContext));
      const desired = projectTargetsForChat(targetModels, chatId, projectionContext);
      const coverage = telegramCoverage.coverage.map((interval) => ({
        coveredAt: interval.coveredAt,
        endAt: new Date(interval.endAt),
        startAt: new Date(interval.startAt)
      }));
      const missing = subtractIntervals(desired, coverage);
      const historySyncBeginningReached = coverage.some(isTelegramHistoryPastCovered);
      const earliestMessageDate = parseOptionalDate(facts.earliestMessageDate);
      const historySyncStartAt =
        historySyncBeginningReached && earliestMessageDate !== undefined
          ? earliestMessageDate
          : undefined;
      const displayedDesired = clipIntervalsForDisplay(desired, historySyncStartAt);
      const displayedCoverage = clipIntervalsForDisplay(coverage, historySyncStartAt);
      const displayedMissing = clipIntervalsForDisplay(missing, historySyncStartAt);
      const coverageMessageCounts = await telegram.countMessagesInIntervals({
        chatId,
        intervals: displayedCoverage.map(intervalToResponse)
      });

      return {
        chat: {
          _model: 'telegram.chat',
          historySyncBeginningReached,
          historySyncStartAt: historySyncStartAt?.toISOString() ?? null,
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
