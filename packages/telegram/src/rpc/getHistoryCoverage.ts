import { query } from '@agentg/framework';
import { z } from 'zod';

import { useDatabase } from '../database/subsystem.js';
import { listTelegramHistoryCoverage } from '../history/coverage.js';
import { nonEmptyStringSchema, telegramHistoryCoverageSegmentSchema } from '../read-model/api.js';

export const telegramGetHistoryCoverageInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

export const telegramGetHistoryCoverageOutputSchema = z.object({
  coverage: z.array(telegramHistoryCoverageSegmentSchema)
});

export type TelegramGetHistoryCoverageInput = z.infer<typeof telegramGetHistoryCoverageInputSchema>;
export type TelegramGetHistoryCoverageOutput = z.infer<
  typeof telegramGetHistoryCoverageOutputSchema
>;

export const getHistoryCoverage = query((procedure) =>
  procedure
    .input(telegramGetHistoryCoverageInputSchema)
    .output(telegramGetHistoryCoverageOutputSchema)
    .query(({ input }) => runGetHistoryCoverage(input))
);

async function runGetHistoryCoverage(
  input: TelegramGetHistoryCoverageInput
): Promise<TelegramGetHistoryCoverageOutput> {
  const database = useDatabase();
  const coverage = await listTelegramHistoryCoverage(database, input.chatId);

  return {
    coverage: coverage.map((interval) => ({
      coveredAt: interval.coveredAt.toISOString(),
      endAt: interval.endAt.toISOString(),
      startAt: interval.startAt.toISOString()
    }))
  };
}
