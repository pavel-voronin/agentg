import { mutation } from '@agentg/rpc/surface';

import { fetchTelegramHistoryPage } from '../../telegramHistoryFetch.js';
import { telegramTdlibPriorities } from '../../telegramTdlibPriority.js';
import {
  telegramHistoryFetchPageInputSchema,
  telegramHistoryFetchPageResultSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';

export const fetchPage = mutation((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramHistoryFetchPageInputSchema)
    .output(telegramHistoryFetchPageResultSchema)
    .mutation(async ({ input }) =>
      fetchTelegramHistoryPage(runtime, input, { priority: telegramTdlibPriorities.low })
    )
);
