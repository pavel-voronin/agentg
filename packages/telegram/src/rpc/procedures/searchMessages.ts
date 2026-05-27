import { query } from '@agentg/rpc/surface';

import { handleSearchMessages } from '../../tdlib-procedure-handlers/searchMessages.js';
import {
  telegramSearchMessagesInputSchema,
  telegramSearchMessagesOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';

export const searchMessages = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramSearchMessagesInputSchema)
    .output(telegramSearchMessagesOutputSchema)
    .query(({ input }) => handleSearchMessages(runtime, input))
);
