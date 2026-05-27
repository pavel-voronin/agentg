import { query } from '@agentg/rpc/surface';

import { handleGetHistoryCoverage } from '../../tdlib-procedure-handlers/getHistoryCoverage.js';
import {
  telegramGetHistoryCoverageInputSchema,
  telegramGetHistoryCoverageOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';

export const getHistoryCoverage = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetHistoryCoverageInputSchema)
    .output(telegramGetHistoryCoverageOutputSchema)
    .query(({ input }) => handleGetHistoryCoverage(runtime, input))
);
