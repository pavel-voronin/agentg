import type { TelegramRequestFileInput, TelegramRequestFileOutput } from '../rpc/contracts.js';
import type { TelegramProcedureHandlerContext } from '../telegram-procedure-runtime/context.js';

export async function handleRequestFile(
  { files }: TelegramProcedureHandlerContext,
  input: TelegramRequestFileInput
): Promise<TelegramRequestFileOutput> {
  return files.requestFile(input);
}
