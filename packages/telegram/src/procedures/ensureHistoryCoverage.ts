import { z } from 'zod';

import { ensureHistoryCoverage } from '../history/fetch.js';
import {
  historyIntervalSchema,
  isoDateTimeStringSchema,
  nonNegativeIntegerSchema,
  positiveIntegerSchema
} from '../views/schemas.js';
import type { ProcedureResources } from './resources.js';

const inputSchema = z.object({
  chatId: z.string().min(1),
  endAt: isoDateTimeStringSchema,
  limit: positiveIntegerSchema.optional(),
  maxPages: positiveIntegerSchema.optional(),
  requestDelayMs: nonNegativeIntegerSchema.optional(),
  startAt: isoDateTimeStringSchema
});

const outputSchema = z.object({
  alreadyCovered: z.boolean(),
  coveredIntervals: z.array(historyIntervalSchema),
  fetchedMessages: nonNegativeIntegerSchema,
  pages: nonNegativeIntegerSchema,
  remainingIntervals: z.array(historyIntervalSchema),
  reachedBeginning: z.boolean(),
  storedMessages: nonNegativeIntegerSchema
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export function ensureHistoryCoverageProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<Output> => {
    const output = await runEnsureHistoryCoverage(inputSchema.parse(input), resources);
    return outputSchema.parse(output);
  };
}

function runEnsureHistoryCoverage(input: Input, resources: ProcedureResources): Promise<Output> {
  return ensureHistoryCoverage(input, resources);
}
