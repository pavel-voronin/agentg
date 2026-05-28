import { query } from '@agentg/rpc/surface';
import {
  telegramCountMessagesInIntervalsInputSchema,
  telegramCountMessagesInIntervalsOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { countTelegramMessagesInIntervals } from '../../messageCounts.js';
import type { TelegramCountMessagesInIntervalsInput } from '../contracts.js';
import type { TelegramProcedureContext } from '../../procedure-runtime/context.js';
import { requireDate } from '../../procedureInputs.js';

export const countMessagesInIntervals = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramCountMessagesInIntervalsInputSchema)
    .output(telegramCountMessagesInIntervalsOutputSchema)
    .query(({ input }) => runCountMessagesInIntervals(runtime, input))
);

async function runCountMessagesInIntervals(
  { database }: TelegramProcedureContext,
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
