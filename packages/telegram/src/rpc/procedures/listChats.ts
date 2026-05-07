import { query } from '@agentg/rpc/surface';
import { z } from 'zod';

import { telegramHistoryChatSchema, telegramHistoryListChatsInputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { discoverHistoryChats, listKnownHistoryChats, parseLimit } from './support.js';

export const listChats = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramHistoryListChatsInputSchema)
    .output(z.array(telegramHistoryChatSchema))
    .query(({ input }) => {
      const { discover } = input;
      const loadBatchSize = parseLimit(input.loadBatchSize, 100, 1000);
      return discover === true
        ? discoverHistoryChats(runtime.database, runtime.client, runtime.eventBus, loadBatchSize)
        : listKnownHistoryChats(runtime.database);
    })
);
