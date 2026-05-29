import { query } from '@agentg/framework/domain';
import { z } from 'zod';

import type { TelegramRpcRuntime } from '../main.js';
import { countTelegramMessagesInIntervals } from '../history/messageCounts.js';
import { requireDate } from '../history/time.js';
import {
  isoDateTimeStringSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema
} from '../read-model/api.js';

export const telegramCountMessagesInIntervalsInputSchema = z.object({
  chatId: nonEmptyStringSchema,
  intervals: z.array(
    z.object({
      endAt: isoDateTimeStringSchema,
      startAt: isoDateTimeStringSchema
    })
  )
});

export const telegramCountMessagesInIntervalsOutputSchema = z.object({
  counts: z.array(nonNegativeIntegerSchema)
});

export type TelegramCountMessagesInIntervalsInput = z.infer<
  typeof telegramCountMessagesInIntervalsInputSchema
>;
export type TelegramCountMessagesInIntervalsOutput = z.infer<
  typeof telegramCountMessagesInIntervalsOutputSchema
>;

export const countMessagesInIntervals = query((runtime: TelegramRpcRuntime, procedure) =>
  procedure
    .input(telegramCountMessagesInIntervalsInputSchema)
    .output(telegramCountMessagesInIntervalsOutputSchema)
    .query(({ input }) => runCountMessagesInIntervals(runtime, input))
);

async function runCountMessagesInIntervals(
  { database }: TelegramRpcRuntime,
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
