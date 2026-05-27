import { countTelegramMessagesInIntervals } from '../telegramMessageCounts.js';
import type { TelegramCountMessagesInIntervalsInput } from '../rpc/contracts.js';
import type { TelegramProcedureHandlerContext } from '../telegram-procedure-runtime/context.js';
import { requireDate } from './helpers.js';

export async function handleCountMessagesInIntervals(
  { database }: TelegramProcedureHandlerContext,
  input: TelegramCountMessagesInIntervalsInput
): Promise<{ counts: number[] }> {
  const intervals = input.intervals.map((interval) => ({
    endAt: requireDate(interval.endAt, 'telegram.countMessagesInIntervals requires endAt'),
    startAt: requireDate(interval.startAt, 'telegram.countMessagesInIntervals requires startAt')
  }));

  return {
    counts: await countTelegramMessagesInIntervals(
      database,
      intervals.map((interval) => ({
        ...interval,
        chatId: input.chatId
      }))
    )
  };
}
