import { query } from '@agentg/rpc/surface';

import {
  listTelegramHistoryCoverage,
  listTelegramHistoryCoverageProofs
} from '../../telegram-history-coverage.js';
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
      const [coverage, proofs] = await Promise.all([
        listTelegramHistoryCoverage(runtime.database, input.chatId),
        listTelegramHistoryCoverageProofs(runtime.database, input.chatId)
      ]);

      return {
        coverage: coverage.map((interval) => ({
          coveredAt: interval.coveredAt.toISOString(),
          endAt: interval.endAt.toISOString(),
          startAt: interval.startAt.toISOString()
        })),
        proofs: proofs.map((interval) => ({
          endAt: interval.endAt.toISOString(),
          provedAt: interval.provedAt.toISOString(),
          startAt: interval.startAt.toISOString()
        }))
      };
    })
);
