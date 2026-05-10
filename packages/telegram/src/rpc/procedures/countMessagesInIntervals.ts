import { query } from '@agentg/rpc/surface';
import {
  telegramCountMessagesInIntervalsInputSchema,
  telegramCountMessagesInIntervalsOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { countTelegramMessagesInIntervals } from '../../telegram-message-counts.js';
import { requireDate } from './support.js';

export const countMessagesInIntervals = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramCountMessagesInIntervalsInputSchema)
    .output(telegramCountMessagesInIntervalsOutputSchema)
    .query(async ({ input }) => {
      const intervals = input.intervals.map((interval) => ({
        endAt: requireDate(interval.endAt, 'telegram.countMessagesInIntervals requires endAt'),
        startAt: requireDate(interval.startAt, 'telegram.countMessagesInIntervals requires startAt')
      }));

      return {
        counts: await countTelegramMessagesInIntervals(
          runtime.database,
          intervals.map((interval) => ({
            ...interval,
            chatId: input.chatId
          }))
        )
      };
    })
);
