import { query } from '@agentg/rpc/surface';

import { handleGetMessage } from '../../tdlib-procedure-handlers/getMessage.js';
import { telegramGetMessageInputSchema, telegramGetMessageOutputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';

export const getMessage = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetMessageInputSchema)
    .output(telegramGetMessageOutputSchema)
    .query(({ input }) => handleGetMessage(runtime, input))
);
