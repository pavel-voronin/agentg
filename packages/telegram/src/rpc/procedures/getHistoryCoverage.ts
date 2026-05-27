import { query } from '@agentg/rpc/surface';
import {
  telegramGetHistoryCoverageInputSchema,
  telegramGetHistoryCoverageOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { listTelegramHistoryCoverage } from '../../telegramHistoryCoverage.js';
import type {
  TelegramGetHistoryCoverageInput,
  TelegramGetHistoryCoverageOutput
} from '../contracts.js';
import type { TelegramProcedureContext } from '../../telegram-procedure-runtime/context.js';

export const getHistoryCoverage = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetHistoryCoverageInputSchema)
    .output(telegramGetHistoryCoverageOutputSchema)
    .query(({ input }) => runGetHistoryCoverage(runtime, input))
);

async function runGetHistoryCoverage(
  { database }: TelegramProcedureContext,
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
