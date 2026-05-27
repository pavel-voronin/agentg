import { query } from '@agentg/rpc/surface';
import {
  telegramGetFileQueueStatsInputSchema,
  telegramGetFileQueueStatsOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import type { TelegramGetFileQueueStatsOutput } from '../contracts.js';
import type { TelegramProcedureContext } from '../../telegram-procedure-runtime/context.js';

export const getFileQueueStats = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetFileQueueStatsInputSchema)
    .output(telegramGetFileQueueStatsOutputSchema)
    .query(() => runGetFileQueueStats(runtime))
);

async function runGetFileQueueStats({
  files
}: TelegramProcedureContext): Promise<TelegramGetFileQueueStatsOutput> {
  return {
    stats: await files.getQueueStats()
  };
}
