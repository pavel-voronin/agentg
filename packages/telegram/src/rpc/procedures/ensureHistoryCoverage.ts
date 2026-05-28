import { mutation } from '@agentg/rpc/domain';
import { z } from 'zod';

import type { TelegramRpcRuntime } from '../setup.js';
import { ensureTelegramHistoryCoverage } from '../../history/fetch.js';
import {
  isoDateTimeStringSchema,
  nonNegativeIntegerSchema,
  positiveIntegerSchema,
  telegramHistoryIntervalSchema
} from '../../read-model/api.js';

export const telegramEnsureHistoryCoverageInputSchema = z.object({
  chatId: z.string().min(1),
  endAt: isoDateTimeStringSchema,
  limit: positiveIntegerSchema.optional(),
  maxPages: positiveIntegerSchema.optional(),
  requestDelayMs: nonNegativeIntegerSchema.optional(),
  startAt: isoDateTimeStringSchema
});

export const telegramEnsureHistoryCoverageOutputSchema = z.object({
  alreadyCovered: z.boolean(),
  coveredIntervals: z.array(telegramHistoryIntervalSchema),
  fetchedMessages: nonNegativeIntegerSchema,
  pages: nonNegativeIntegerSchema,
  remainingIntervals: z.array(telegramHistoryIntervalSchema),
  reachedBeginning: z.boolean(),
  storedMessages: nonNegativeIntegerSchema
});

export type TelegramEnsureHistoryCoverageInput = z.infer<
  typeof telegramEnsureHistoryCoverageInputSchema
>;
export type TelegramEnsureHistoryCoverageOutput = z.infer<
  typeof telegramEnsureHistoryCoverageOutputSchema
>;

export const ensureHistoryCoverage = mutation((runtime: TelegramRpcRuntime, procedure) =>
  procedure
    .input(telegramEnsureHistoryCoverageInputSchema)
    .output(telegramEnsureHistoryCoverageOutputSchema)
    .mutation(({ input }) => runEnsureHistoryCoverage(runtime, input))
);

function runEnsureHistoryCoverage(
  context: TelegramRpcRuntime,
  input: TelegramEnsureHistoryCoverageInput
): Promise<TelegramEnsureHistoryCoverageOutput> {
  return ensureTelegramHistoryCoverage(context, input);
}
