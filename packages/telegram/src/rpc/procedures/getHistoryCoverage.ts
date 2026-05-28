import { query } from '@agentg/rpc/domain';
import { z } from 'zod';

import type { TelegramRpcRuntime } from '../setup.js';
import { listTelegramHistoryCoverage } from '../../history/coverage.js';
import {
  nonEmptyStringSchema,
  telegramHistoryCoverageSegmentSchema
} from '../../read-model/api.js';

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

export const getHistoryCoverage = query((runtime: TelegramRpcRuntime, procedure) =>
  procedure
    .input(telegramGetHistoryCoverageInputSchema)
    .output(telegramGetHistoryCoverageOutputSchema)
    .query(({ input }) => runGetHistoryCoverage(runtime, input))
);

async function runGetHistoryCoverage(
  { database }: TelegramRpcRuntime,
  input: TelegramGetHistoryCoverageInput
): Promise<TelegramGetHistoryCoverageOutput> {
  const coverage = await listTelegramHistoryCoverage(database, input.chatId);

  return {
    coverage: coverage.map((interval) => ({
      coveredAt: interval.coveredAt.toISOString(),
      endAt: interval.endAt.toISOString(),
      startAt: interval.startAt.toISOString()
    }))
  };
}
