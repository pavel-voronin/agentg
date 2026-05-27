import { query } from '@agentg/rpc/surface';

import {
  telegramGetFileQueueStatsInputSchema,
  telegramGetFileQueueStatsOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { handleGetFileQueueStats } from '../../tdlib-procedure-handlers/getFileQueueStats.js';

export const getFileQueueStats = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetFileQueueStatsInputSchema)
    .output(telegramGetFileQueueStatsOutputSchema)
    .query(() => handleGetFileQueueStats(runtime))
);
