import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import type { EventBus } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { historySyncTargets } from '../database/schema.js';
import type { TelegramHistoryClient } from '../model/types.js';
import {
  clipIntervalsForDisplay,
  currentHistorySyncProjectionContext,
  intervalToResponse,
  isTelegramHistoryPastCovered,
  parseOptionalDate,
  toHistorySyncTarget,
  toTargetResponse
} from '../model/readModel.js';
import {
  historySyncRangeSchema,
  isoDateTimeStringSchema,
  nonEmptyStringSchema
} from '../range/rangeSchema.js';
import { subtractIntervals } from '../range/ranges.js';
import type { Controller } from '../sync/controller.js';
import { projectTargetsForChat } from '../sync/reconciler.js';
import {
  deleteManualHistorySyncTargetFromCommand,
  upsertManualHistorySyncTargetFromCommand
} from '../target/commands.js';

type Resources = {
  controller: Controller;
  database: Database;
  events: EventBus;
  telegram: TelegramHistoryClient;
};

const requestSyncInputSchema = z
  .object({
    chatId: nonEmptyStringSchema.optional()
  })
  .default({});

const requestSyncOutputSchema = z.object({
  requested: z.boolean()
});

const selectedChatOutputSchema = z.object({
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

const intervalOutputSchema = z.object({
  coveredAt: isoDateTimeStringSchema.optional(),
  endAt: isoDateTimeStringSchema,
  messageCount: z.number().int().nonnegative().optional(),
  startAt: isoDateTimeStringSchema
});

const targetOutputSchema = z.object({
  chatId: z.string(),
  id: z.string(),
  projected: intervalOutputSchema.optional(),
  range: historySyncRangeSchema,
  templateId: z.string().nullable().optional()
});

const stateInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

const stateOutputSchema = z.object({
  chat: selectedChatOutputSchema.nullable(),
  coverage: z.array(intervalOutputSchema),
  desired: z.array(intervalOutputSchema),
  missing: z.array(intervalOutputSchema),
  targets: z.array(targetOutputSchema)
});

const upsertTargetInputSchema = z
  .object({
    chatId: nonEmptyStringSchema,
    end: nonEmptyStringSchema.optional(),
    preset: nonEmptyStringSchema.optional(),
    range: historySyncRangeSchema.optional(),
    start: nonEmptyStringSchema.optional(),
    targetId: nonEmptyStringSchema.optional()
  })
  .superRefine((value, context) => {
    if (value.preset !== undefined || value.range !== undefined) {
      return;
    }
    if (value.start !== undefined && value.end !== undefined) {
      return;
    }

    context.addIssue({
      code: 'custom',
      message: 'history-sync.upsertTarget requires preset, range, or start/end'
    });
  });

const deleteTargetInputSchema = z.object({
  targetId: nonEmptyStringSchema
});

const targetMutationOutputSchema = z.object({
  deleted: z.boolean(),
  target: targetOutputSchema.optional(),
  upserted: z.boolean()
});

type StateOutput = z.infer<typeof stateOutputSchema>;
type TargetMutationOutput = z.infer<typeof targetMutationOutputSchema>;

export function procedures(resources: Resources) {
  return {
    async deleteTarget(input: unknown): Promise<TargetMutationOutput> {
      const target = await deleteManualHistorySyncTargetFromCommand(
        resources.database,
        deleteTargetInputSchema.parse(input)
      );
      const response = toTargetResponse(targetRow(target), currentHistorySyncProjectionContext());

      resources.events.publish('history-sync.target.deleted', {
        chatId: response.chatId,
        target: response
      });
      resources.events.publish('history-sync.sync.requested', {
        reason: 'target-deleted'
      });
      resources.controller.request('target-deleted');

      return targetMutationOutputSchema.parse({
        deleted: true,
        target: response,
        upserted: false
      });
    },

    async getChatHistorySyncState(input: unknown): Promise<StateOutput> {
      const parsed = stateInputSchema.parse(input);
      const output = await runGetChatHistorySyncState(resources, parsed.chatId);
      return stateOutputSchema.parse(output);
    },

    requestSync(input: unknown) {
      const parsed = requestSyncInputSchema.parse(input);
      resources.events.publish('history-sync.sync.requested', {
        ...(parsed.chatId === undefined ? {} : { chatId: parsed.chatId }),
        reason: 'manual'
      });
      resources.controller.request(
        parsed.chatId === undefined ? 'manual' : `manual:${parsed.chatId}`
      );

      return requestSyncOutputSchema.parse({
        requested: true
      });
    },

    async upsertTarget(input: unknown): Promise<TargetMutationOutput> {
      const target = await upsertManualHistorySyncTargetFromCommand(
        resources.database,
        upsertTargetInputSchema.parse(input)
      );
      const response = toTargetResponse(targetRow(target), currentHistorySyncProjectionContext());

      resources.events.publish('history-sync.target.upserted', {
        chatId: response.chatId,
        target: response
      });
      resources.events.publish('history-sync.sync.requested', {
        reason: 'target-upserted'
      });
      resources.controller.request('target-upserted');

      return targetMutationOutputSchema.parse({
        deleted: false,
        target: response,
        upserted: true
      });
    }
  };
}

async function runGetChatHistorySyncState(
  resources: Resources,
  chatId: string
): Promise<StateOutput> {
  const [facts, telegramCoverage] = await Promise.all([
    resources.telegram.getChatHistoryFacts({ chatId }),
    resources.telegram.getHistoryCoverage({ chatId })
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

  const targetRows = await resources.database
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
  const coverageMessageCounts = await resources.telegram.countMessagesInIntervals({
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
}

function targetRow(target: {
  chatId: string;
  id: string;
  range: z.infer<typeof historySyncRangeSchema>;
  templateId?: string | undefined;
}) {
  return {
    id: target.id,
    range: target.range,
    telegramChatId: target.chatId,
    templateId: target.templateId ?? null
  };
}
