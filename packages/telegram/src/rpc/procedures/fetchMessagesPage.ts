import { mutation } from '@agentg/rpc/surface';

import { handleFetchMessagesPage } from '../../tdlib-procedure-handlers/fetchMessagesPage.js';
import {
  telegramFetchMessagesPageInputSchema,
  telegramFetchMessagesPageOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';

export const fetchMessagesPage = mutation((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramFetchMessagesPageInputSchema)
    .output(telegramFetchMessagesPageOutputSchema)
    .mutation(({ input }) => handleFetchMessagesPage(runtime, input))
);
