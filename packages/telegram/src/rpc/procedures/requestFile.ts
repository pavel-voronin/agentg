import { mutation } from '@agentg/rpc/surface';

import { telegramRequestFileInputSchema, telegramRequestFileOutputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';

export const requestFile = mutation((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramRequestFileInputSchema)
    .output(telegramRequestFileOutputSchema)
    .mutation(async ({ input }) => {
      return runtime.files.requestFile(input);
    })
);
