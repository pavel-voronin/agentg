import { and, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramMessages } from '../database/schema.js';

export type MessageCountInterval = {
  chatId: string;
  endAt: Date;
  startAt: Date;
};

export async function countMessagesInIntervals(
  database: Database,
  intervals: MessageCountInterval[]
): Promise<number[]> {
  return Promise.all(
    intervals.map(async (interval) => {
      const [row] = await database
        .select({
          count: sql<number>`count(*)::int`
        })
        .from(telegramMessages)
        .where(
          and(
            eq(telegramMessages.chatId, interval.chatId),
            isNotNull(telegramMessages.date),
            gte(telegramMessages.date, interval.startAt),
            lt(telegramMessages.date, interval.endAt)
          )
        );

      return row?.count ?? 0;
    })
  );
}
