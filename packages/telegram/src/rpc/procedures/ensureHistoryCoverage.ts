import { mutation } from '@agentg/rpc/surface';
import {
  telegramEnsureHistoryCoverageInputSchema,
  telegramEnsureHistoryCoverageOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import type {
  TelegramEnsureHistoryCoverageInput,
  TelegramEnsureHistoryCoverageOutput
} from '../contracts.js';
import { ensureTelegramHistoryCoverage } from '../../telegramHistoryFetch.js';
import type { TelegramProcedureContext } from '../../telegram-procedure-runtime/context.js';

export const ensureHistoryCoverage = mutation((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramEnsureHistoryCoverageInputSchema)
    .output(telegramEnsureHistoryCoverageOutputSchema)
    .mutation(({ input }) => runEnsureHistoryCoverage(runtime, input))
);

function runEnsureHistoryCoverage(
  context: TelegramProcedureContext,
  input: TelegramEnsureHistoryCoverageInput
): Promise<TelegramEnsureHistoryCoverageOutput> {
  return ensureTelegramHistoryCoverage(context, input);
}
