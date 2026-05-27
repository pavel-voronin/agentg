import { mutation } from '@agentg/rpc/surface';

import { handleFetchPage } from '../../tdlib-procedure-handlers/fetchPage.js';
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
    .mutation(({ input }) => handleFetchPage(runtime, input))
);
