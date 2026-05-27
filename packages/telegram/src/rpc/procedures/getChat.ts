import { query } from '@agentg/rpc/surface';

import { handleGetChat } from '../../tdlib-procedure-handlers/getChat.js';
import { telegramGetChatInputSchema, telegramGetChatOutputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';

export const getChat = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetChatInputSchema)
    .output(telegramGetChatOutputSchema)
    .query(({ input }) => handleGetChat(runtime, input))
);
