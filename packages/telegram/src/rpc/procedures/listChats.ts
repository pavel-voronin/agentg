import { query } from '@agentg/rpc/surface';
import { z } from 'zod';

import { handleListChats } from '../../tdlib-procedure-handlers/listChats.js';
import { telegramHistoryChatSchema, telegramHistoryListChatsInputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';

export const listChats = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramHistoryListChatsInputSchema)
    .output(z.array(telegramHistoryChatSchema))
    .query(({ input }) => handleListChats(runtime, input))
);
