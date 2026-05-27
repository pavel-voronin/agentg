import { mutation } from '@agentg/rpc/surface';
import { telegramRequestFileInputSchema, telegramRequestFileOutputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import type { TelegramRequestFileInput, TelegramRequestFileOutput } from '../contracts.js';
import type { TelegramProcedureContext } from '../../telegram-procedure-runtime/context.js';

export const requestFile = mutation((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramRequestFileInputSchema)
    .output(telegramRequestFileOutputSchema)
    .mutation(({ input }) => runRequestFile(runtime, input))
);

async function runRequestFile(
  { files }: TelegramProcedureContext,
  input: TelegramRequestFileInput
): Promise<TelegramRequestFileOutput> {
  return files.requestFile(input);
}
