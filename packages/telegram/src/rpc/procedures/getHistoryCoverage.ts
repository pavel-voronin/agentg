import { query } from '@agentg/rpc/surface';

import { listTelegramHistoryCoverage } from '../../telegram-history-coverage.js';
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
    .query(async ({ input }) => {
      const coverage = await listTelegramHistoryCoverage(runtime.database, input.chatId);

      return {
        coverage: coverage.map((interval) => ({
          coveredAt: interval.coveredAt.toISOString(),
          endAt: interval.endAt.toISOString(),
          startAt: interval.startAt.toISOString()
        }))
      };
    })
);
