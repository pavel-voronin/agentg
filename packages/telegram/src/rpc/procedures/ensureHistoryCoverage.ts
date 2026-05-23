import { mutation } from '@agentg/rpc/surface';

import { ensureTelegramHistoryCoverage } from '../../telegramHistoryFetch.js';
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
    .mutation(async ({ input }) => ensureTelegramHistoryCoverage(runtime, input))
);
