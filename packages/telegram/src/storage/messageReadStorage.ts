import { and, asc, desc, eq, gte, ilike, lt, or, sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramMessages } from '../database/schema.js';
import {
  parseTelegramInt53,
  type MessageOwner,
  type PageSelector,
  type RangeSelector
} from '../domain/models/messageSelection.js';
import { HISTORY_TICK_MS } from '../history/time.js';
import { messageChatCondition, ownerMessageCondition } from './messageOwnerCondition.js';
import {
  messageTextExpression,
  readMessageSelection,
  toMessageStorageRows,
  type MessageStorageRow
} from './messageRowStorage.js';
import { andSql } from './sqlCondition.js';

export type RecentMessageRead = {
  beforeMessageId?: string | undefined;
  chatId?: string | undefined;
  limit: number;
};

export type MessageSearchRead = {
  chatId?: string | undefined;
  limit: number;
  query: string;
};

export type MessageRangeCountInput = {
  chatId: string;
  ranges: readonly {
    endAt: Date;
    startAt: Date;
  }[];
};

export async function countMessageRowsByRanges(
  database: Database,
  input: MessageRangeCountInput
): Promise<number[]> {
  return Promise.all(
    input.ranges.map(async (range) => {
      if (range.startAt >= range.endAt) {
        return 0;
      }
      const [row] = await database
        .select({
          messageCount: sql<number>`count(*)::int`
        })
        .from(telegramMessages)
        .where(
          and(
            eq(telegramMessages.chatId, input.chatId),
            gte(telegramMessages.date, range.startAt),
            lt(telegramMessages.date, range.endAt)
          )
        );
      return row?.messageCount ?? 0;
    })
  );
}

export async function readPageRows(
  database: Database,
  owner: MessageOwner,
  selector: PageSelector
): Promise<MessageStorageRow[]> {
  const before =
    selector.beforeMessageId === undefined
      ? undefined
      : parseTelegramInt53(selector.beforeMessageId, 'beforeMessageId');
  const rows = await database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(
      and(
        ownerMessageCondition(owner),
        before === undefined ? undefined : sql`${telegramMessages.id}::bigint < ${before}`
      )
    )
    .orderBy(sql`${telegramMessages.id}::bigint desc`)
    .limit(selector.count);

  return toMessageStorageRows([...rows].reverse());
}

export async function readRangeRows(
  database: Database,
  owner: MessageOwner,
  selector: RangeSelector
): Promise<MessageStorageRow[]> {
  const startAt = new Date(selector.startAt);
  const endAt = new Date(selector.endAt);
  if (startAt >= endAt) {
    return [];
  }

  const rows = await database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(
      and(
        ownerMessageCondition(owner),
        gte(telegramMessages.date, startAt),
        lt(telegramMessages.date, endAt)
      )
    )
    .orderBy(asc(telegramMessages.date), sql`${telegramMessages.id}::bigint asc`);
  return toMessageStorageRows(rows);
}

export async function readRecentMessageRows(
  database: Database,
  input: RecentMessageRead
): Promise<MessageStorageRow[]> {
  const where = andSql(
    input.chatId === undefined ? undefined : eq(telegramMessages.chatId, input.chatId),
    input.beforeMessageId === undefined
      ? undefined
      : sql`${telegramMessages.id}::bigint < ${input.beforeMessageId}::bigint`
  );
  const rows = await database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(where)
    .orderBy(desc(telegramMessages.date), sql`${telegramMessages.id}::bigint desc`)
    .limit(input.limit);
  return toMessageStorageRows(rows);
}

export async function searchMessageRows(
  database: Database,
  input: MessageSearchRead
): Promise<MessageStorageRow[]> {
  const textFilter = ilike(
    sql<string>`coalesce(${messageTextExpression()}, '')`,
    `%${input.query}%`
  );
  const where =
    input.chatId === undefined
      ? textFilter
      : and(eq(telegramMessages.chatId, input.chatId), textFilter);
  const rows = await database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(where)
    .orderBy(desc(telegramMessages.date), sql`${telegramMessages.id}::bigint desc`)
    .limit(input.limit);
  return toMessageStorageRows(rows);
}

export async function readMessageRowsByRefs(
  database: Database,
  refs: readonly {
    chatId: string;
    messageId: string;
  }[]
): Promise<MessageStorageRow[]> {
  if (refs.length === 0) {
    return [];
  }
  const rows = await database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(
      or(
        ...refs.map((ref) =>
          and(eq(telegramMessages.chatId, ref.chatId), eq(telegramMessages.id, ref.messageId))
        )
      )
    );
  return toMessageStorageRows(rows);
}

export async function readMessageRow(
  database: Database,
  input: {
    chatId: string;
    messageId: string;
  }
): Promise<MessageStorageRow | undefined> {
  const [row] = await readMessageRowsByRefs(database, [input]);
  return row;
}

export async function readPageEndAt(
  database: Database,
  owner: MessageOwner,
  beforeMessageId: string | undefined
): Promise<Date | undefined> {
  if (beforeMessageId === undefined) {
    const [row] = await database
      .select({
        messageDate: telegramMessages.date
      })
      .from(telegramMessages)
      .where(ownerMessageCondition(owner))
      .orderBy(sql`${telegramMessages.id}::bigint desc`)
      .limit(1);

    return row?.messageDate === null || row?.messageDate === undefined
      ? undefined
      : nextHistorySecond(row.messageDate);
  }

  const [row] = await database
    .select({
      messageDate: telegramMessages.date
    })
    .from(telegramMessages)
    .where(
      and(
        ownerMessageCondition(owner),
        eq(telegramMessages.id, beforeMessageId),
        messageChatCondition(owner)
      )
    )
    .limit(1);

  return row?.messageDate === null || row?.messageDate === undefined
    ? undefined
    : nextHistorySecond(row.messageDate);
}

function nextHistorySecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / HISTORY_TICK_MS) * HISTORY_TICK_MS + HISTORY_TICK_MS);
}
