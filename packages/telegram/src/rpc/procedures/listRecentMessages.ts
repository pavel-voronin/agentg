import { query } from '@agentg/rpc/surface';

import { handleListRecentMessages } from '../../tdlib-procedure-handlers/listRecentMessages.js';
import {
  telegramListRecentMessagesInputSchema,
  telegramListRecentMessagesOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';

export const listRecentMessages = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramListRecentMessagesInputSchema)
    .output(telegramListRecentMessagesOutputSchema)
    .query(({ input }) => handleListRecentMessages(runtime, input))
);
