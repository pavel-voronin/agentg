import { and, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';

import type { TelegramDatabase as AppDatabase } from './database.js';
import { telegramMessages } from './schema.js';

export type TelegramMessageCountInterval = {
  chatId: string;
  endAt: Date;
  startAt: Date;
};

export async function countTelegramMessagesInIntervals(
  database: AppDatabase,
  intervals: TelegramMessageCountInterval[]
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
            eq(telegramMessages.telegramChatId, interval.chatId),
            isNotNull(telegramMessages.messageDate),
            gte(telegramMessages.messageDate, interval.startAt),
            lt(telegramMessages.messageDate, interval.endAt)
          )
        );

      return row?.count ?? 0;
    })
  );
}
