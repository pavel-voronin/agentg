import type { TelegramGetFileQueueStatsOutput } from '../rpc/contracts.js';
import type { TelegramProcedureHandlerContext } from '../telegram-procedure-runtime/context.js';

export async function handleGetFileQueueStats({
  files
}: TelegramProcedureHandlerContext): Promise<TelegramGetFileQueueStatsOutput> {
  return {
    stats: await files.getQueueStats()
  };
}
