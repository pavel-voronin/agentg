import { mutation } from '@agentg/rpc/surface';

import { fetchTelegramHistoryPage } from '../../telegram-history-fetch.js';
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
    .mutation(async ({ input }) => fetchTelegramHistoryPage(runtime, input, { priority: 'p4' }))
);
