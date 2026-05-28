import { mutation } from '@agentg/rpc/surface';
import {
  telegramHistoryFetchPageInputSchema,
  telegramHistoryFetchPageResultSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import type {
  TelegramHistoryFetchPageRequest,
  TelegramHistoryFetchPageResult
} from '../contracts.js';
import { fetchTelegramHistoryPage } from '../../historyFetch.js';
import { telegramTdlibPriorities } from '../../tdlib/priority.js';
import type { TelegramProcedureContext } from '../../procedure-runtime/context.js';

export const fetchPage = mutation((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramHistoryFetchPageInputSchema)
    .output(telegramHistoryFetchPageResultSchema)
    .mutation(({ input }) => runFetchPage(runtime, input))
);

function runFetchPage(
  context: TelegramProcedureContext,
  input: TelegramHistoryFetchPageRequest
): Promise<TelegramHistoryFetchPageResult> {
  return fetchTelegramHistoryPage(context, input, { priority: telegramTdlibPriorities.low });
}
