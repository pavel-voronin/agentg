import type {
  TelegramEnsureHistoryCoverageInput,
  TelegramEnsureHistoryCoverageOutput
} from '../rpc/contracts.js';
import { ensureTelegramHistoryCoverage } from '../telegramHistoryFetch.js';
import type { TelegramProcedureHandlerContext } from '../telegram-procedure-runtime/context.js';

export function handleEnsureHistoryCoverage(
  context: TelegramProcedureHandlerContext,
  input: TelegramEnsureHistoryCoverageInput
): Promise<TelegramEnsureHistoryCoverageOutput> {
  return ensureTelegramHistoryCoverage(context, input);
}
