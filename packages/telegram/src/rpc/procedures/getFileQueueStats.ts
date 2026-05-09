import { query } from '@agentg/rpc/surface';

import {
  telegramGetFileQueueStatsInputSchema,
  telegramGetFileQueueStatsOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { readTelegramFileQueueStats } from '../../telegram-file-store.js';

export const getFileQueueStats = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetFileQueueStatsInputSchema)
    .output(telegramGetFileQueueStatsOutputSchema)
    .query(async () => ({
      stats: await readTelegramFileQueueStats(runtime.database)
    }))
);
