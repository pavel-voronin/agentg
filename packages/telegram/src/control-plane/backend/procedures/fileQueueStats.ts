import { query } from '@agentg/rpc/surface';
import { fileQueueStatsInputSchema, fileQueueStatsOutputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../../../rpc/runtime.js';
import { rpc } from '../../../rpc/trpc.js';
import type { FileQueueStatsOutput } from '../contracts.js';
import type { TelegramProcedureContext } from '../../../procedure-runtime/context.js';

export const fileQueueStats = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(fileQueueStatsInputSchema)
    .output(fileQueueStatsOutputSchema)
    .query(() => runFileQueueStats(runtime))
);

async function runFileQueueStats({
  files
}: TelegramProcedureContext): Promise<FileQueueStatsOutput> {
  return {
    stats: await files.getQueueStats()
  };
}
