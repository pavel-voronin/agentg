import { mutation } from '@agentg/rpc/surface';

import { handleEnsureHistoryCoverage } from '../../tdlib-procedure-handlers/ensureHistoryCoverage.js';
import {
  telegramEnsureHistoryCoverageInputSchema,
  telegramEnsureHistoryCoverageOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';

export const ensureHistoryCoverage = mutation((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramEnsureHistoryCoverageInputSchema)
    .output(telegramEnsureHistoryCoverageOutputSchema)
    .mutation(({ input }) => handleEnsureHistoryCoverage(runtime, input))
);
