import { query } from '@agentg/rpc/surface';
import { and, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';

import {
  telegramCountMessagesInIntervalsInputSchema,
  telegramCountMessagesInIntervalsOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { telegramMessages } from '../../schema.js';
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
        counts: await Promise.all(
          intervals.map(async (interval) => {
            const [row] = await runtime.database
              .select({
                count: sql<number>`count(*)::int`
              })
              .from(telegramMessages)
              .where(
                and(
                  eq(telegramMessages.telegramChatId, input.chatId),
                  isNotNull(telegramMessages.messageDate),
                  gte(telegramMessages.messageDate, interval.startAt),
                  lt(telegramMessages.messageDate, interval.endAt)
                )
              );

            return row?.count ?? 0;
          })
        )
      };
    })
);
