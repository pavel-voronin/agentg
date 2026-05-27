import { listTelegramHistoryCoverage } from '../telegramHistoryCoverage.js';
import type {
  TelegramGetHistoryCoverageInput,
  TelegramGetHistoryCoverageOutput
} from '../rpc/contracts.js';
import type { TelegramProcedureHandlerContext } from '../telegram-procedure-runtime/context.js';

export async function handleGetHistoryCoverage(
  { database }: TelegramProcedureHandlerContext,
  input: TelegramGetHistoryCoverageInput
): Promise<TelegramGetHistoryCoverageOutput> {
  const coverage = await listTelegramHistoryCoverage(database, input.chatId);

  return {
    coverage: coverage.map((interval) => ({
      coveredAt: interval.coveredAt.toISOString(),
      endAt: interval.endAt.toISOString(),
      startAt: interval.startAt.toISOString()
    }))
  };
}
