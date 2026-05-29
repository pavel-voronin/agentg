import { query } from '@agentg/framework';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { useDatabase } from '../database/subsystem.js';
import { subtractIntervals } from '../ranges.js';
import {
  historySyncRangeSchema,
  isoDateTimeStringSchema,
  nonEmptyStringSchema
} from '../rangeSchema.js';
import { projectTargetsForChat } from '../reconciler.js';
import { historySyncTargets } from '../schema.js';
import { useTelegram } from '../telegram/subsystem.js';
import {
  clipIntervalsForDisplay,
  currentHistorySyncProjectionContext,
  intervalToResponse,
  isTelegramHistoryPastCovered,
  parseOptionalDate,
  toHistorySyncTarget,
  toTargetResponse
} from '../readModel.js';

export const historySyncGetChatHistorySyncStateInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

export const historySyncSelectedChatOutputSchema = z.object({
  _model: z.literal('telegram.chat'),
  historySyncBeginningReached: z.boolean(),
  historySyncStartAt: isoDateTimeStringSchema.nullable(),
  id: z.string(),
  isBot: z.boolean(),
  messageCount: z.number().int().nonnegative(),
  title: z.string(),
  type: z.string(),
  updatedAt: isoDateTimeStringSchema
});

export const historySyncIntervalOutputSchema = z.object({
  coveredAt: isoDateTimeStringSchema.optional(),
  endAt: isoDateTimeStringSchema,
  messageCount: z.number().int().nonnegative().optional(),
  startAt: isoDateTimeStringSchema
});

export const historySyncTargetOutputSchema = z.object({
  chatId: z.string(),
  id: z.string(),
  projected: historySyncIntervalOutputSchema.optional(),
  range: historySyncRangeSchema,
  templateId: z.string().nullable().optional()
});

export const historySyncChatHistorySyncStateOutputSchema = z.object({
  chat: historySyncSelectedChatOutputSchema.nullable(),
  coverage: z.array(historySyncIntervalOutputSchema),
  desired: z.array(historySyncIntervalOutputSchema),
  missing: z.array(historySyncIntervalOutputSchema),
  targets: z.array(historySyncTargetOutputSchema)
});

export type HistorySyncGetChatHistorySyncStateInput = z.infer<
  typeof historySyncGetChatHistorySyncStateInputSchema
>;
export type HistorySyncChatHistorySyncStateOutput = z.infer<
  typeof historySyncChatHistorySyncStateOutputSchema
>;
export type HistorySyncIntervalOutput = z.infer<typeof historySyncIntervalOutputSchema>;
export type HistorySyncTargetOutput = z.infer<typeof historySyncTargetOutputSchema>;

export const getChatHistorySyncState = query((procedure) =>
  procedure
    .input(historySyncGetChatHistorySyncStateInputSchema)
    .output(historySyncChatHistorySyncStateOutputSchema)
    .query(async ({ input }) => {
      const database = useDatabase();
      const telegram = useTelegram();
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

      const targetRows = await database
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
