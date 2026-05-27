import type {
  TelegramHistoryFetchPageRequest,
  TelegramHistoryFetchPageResult
} from '../rpc/contracts.js';
import { fetchTelegramHistoryPage } from '../telegramHistoryFetch.js';
import { telegramTdlibPriorities } from '../telegramTdlibPriority.js';
import type { TelegramProcedureHandlerContext } from '../telegram-procedure-runtime/context.js';

export function handleFetchPage(
  context: TelegramProcedureHandlerContext,
  input: TelegramHistoryFetchPageRequest
): Promise<TelegramHistoryFetchPageResult> {
  return fetchTelegramHistoryPage(context, input, { priority: telegramTdlibPriorities.low });
}
