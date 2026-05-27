import { query } from '@agentg/rpc/surface';

import { handleGetChatHistoryFacts } from '../../tdlib-procedure-handlers/getChatHistoryFacts.js';
import {
  telegramGetChatHistoryFactsInputSchema,
  telegramGetChatHistoryFactsOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';

export const getChatHistoryFacts = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetChatHistoryFactsInputSchema)
    .output(telegramGetChatHistoryFactsOutputSchema)
    .query(({ input }) => handleGetChatHistoryFacts(runtime, input))
);
