import { query } from '@agentg/rpc/surface';

import { handleListChatDirectory } from '../../tdlib-procedure-handlers/listChatDirectory.js';
import {
  telegramListChatDirectoryInputSchema,
  telegramListChatDirectoryOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';

export const listChatDirectory = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramListChatDirectoryInputSchema)
    .output(telegramListChatDirectoryOutputSchema)
    .query(({ input }) => handleListChatDirectory(runtime, input))
);
