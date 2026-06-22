import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramChats, telegramMessages } from '../database/schema.js';
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

export type MessageListRead = {
  chatId?: string | undefined;
  chatIdGt?: string | undefined;
  chatIdGte?: string | undefined;
  chatIdLt?: string | undefined;
  chatIdLte?: string | undefined;
  contentType?: string | undefined;
  endAt?: Date | string | undefined;
  limit: number;
  messageDateGt?: Date | string | undefined;
  messageDateGte?: Date | string | undefined;
  messageDateLt?: Date | string | undefined;
  messageDateLte?: Date | string | undefined;
  messageId?: string | undefined;
  messageIdGt?: string | undefined;
  messageIdGte?: string | undefined;
  messageIdLt?: string | undefined;
  messageIdLte?: string | undefined;
  messageIds?: readonly string[] | undefined;
  offset?: number | undefined;
  order?: { direction: 'asc' | 'desc'; key: 'date' | 'id' | 'text' } | undefined;
  readState?: 'read' | 'unread' | undefined;
  senderQueryNot?: string | undefined;
  senderQuery?: string | undefined;
  startAt?: Date | string | undefined;
  textQueryNot?: string | undefined;
  textQuery?: string | undefined;
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

export async function readMessageRows(
  database: Database,
  input: MessageListRead
): Promise<MessageStorageRow[]> {
  if (input.messageIds?.length === 0) {
    return [];
  }
  const startAt = dateBound(input.startAt);
  const endAt = dateBound(input.endAt);
  const messageDateGt = dateBound(input.messageDateGt);
  const messageDateGte = dateBound(input.messageDateGte);
  const messageDateLt = dateBound(input.messageDateLt);
  const messageDateLte = dateBound(input.messageDateLte);
  if (startAt !== undefined && endAt !== undefined && startAt >= endAt) {
    return [];
  }

  const where = andSql(
    input.chatId === undefined ? undefined : eq(telegramMessages.chatId, input.chatId),
    input.chatIdGte === undefined
      ? undefined
      : sql`${telegramMessages.chatId}::bigint >= ${input.chatIdGte}::bigint`,
    input.chatIdGt === undefined
      ? undefined
      : sql`${telegramMessages.chatId}::bigint > ${input.chatIdGt}::bigint`,
    input.chatIdLte === undefined
      ? undefined
      : sql`${telegramMessages.chatId}::bigint <= ${input.chatIdLte}::bigint`,
    input.chatIdLt === undefined
      ? undefined
      : sql`${telegramMessages.chatId}::bigint < ${input.chatIdLt}::bigint`,
    input.messageIds === undefined
      ? undefined
      : inArray(telegramMessages.id, [...input.messageIds]),
    input.messageId === undefined ? undefined : eq(telegramMessages.id, input.messageId),
    input.messageIdGte === undefined
      ? undefined
      : sql`${telegramMessages.id}::bigint >= ${input.messageIdGte}::bigint`,
    input.messageIdGt === undefined
      ? undefined
      : sql`${telegramMessages.id}::bigint > ${input.messageIdGt}::bigint`,
    input.messageIdLte === undefined
      ? undefined
      : sql`${telegramMessages.id}::bigint <= ${input.messageIdLte}::bigint`,
    input.messageIdLt === undefined
      ? undefined
      : sql`${telegramMessages.id}::bigint < ${input.messageIdLt}::bigint`,
    startAt === undefined ? undefined : gte(telegramMessages.date, startAt),
    endAt === undefined ? undefined : lt(telegramMessages.date, endAt),
    messageDateGte === undefined ? undefined : gte(telegramMessages.date, messageDateGte),
    messageDateGt === undefined ? undefined : sql`${telegramMessages.date} > ${messageDateGt}`,
    messageDateLte === undefined ? undefined : sql`${telegramMessages.date} <= ${messageDateLte}`,
    messageDateLt === undefined ? undefined : lt(telegramMessages.date, messageDateLt),
    input.contentType === undefined
      ? undefined
      : sql`coalesce(${telegramMessages.content}->>'_', 'unknown') = ${input.contentType}`,
    input.senderQuery === undefined ? undefined : senderQueryWhere(input.senderQuery),
    input.senderQueryNot === undefined ? undefined : notSenderQueryWhere(input.senderQueryNot),
    input.textQuery === undefined
      ? undefined
      : textQueryWhere(sql`coalesce(${messageTextExpression()}, '')`, input.textQuery),
    input.textQueryNot === undefined
      ? undefined
      : notTextQueryWhere(sql`coalesce(${messageTextExpression()}, '')`, input.textQueryNot),
    messageReadStateWhere(input.readState)
  );

  const rows = await database
    .select(readMessageSelection())
    .from(telegramMessages)
    .leftJoin(telegramChats, eq(telegramChats.id, telegramMessages.chatId))
    .where(where)
    .orderBy(...messageListOrderBy(input))
    .limit(input.limit)
    .offset(input.offset ?? 0);
  return toMessageStorageRows(rows);
}

function senderQueryWhere(query: string): SQL | undefined {
  return andSql(
    ...wildcardPatterns(query).map(
      (pattern) => sql`(
        (${telegramMessages.senderId}->>'_' = 'messageSenderUser' and exists (
          select 1 from telegram_users sender_users
          where sender_users.id = ${telegramMessages.senderId}->>'user_id'
            and coalesce(sender_users.first_name, '') || ' ' || coalesce(sender_users.last_name, '') ilike ${pattern} escape '\\'
        ))
        or
        (${telegramMessages.senderId}->>'_' = 'messageSenderChat' and exists (
          select 1 from telegram_chats sender_chats
          where sender_chats.id = ${telegramMessages.senderId}->>'chat_id'
            and coalesce(sender_chats.title, '') ilike ${pattern} escape '\\'
        ))
      )`
    )
  );
}

function notSenderQueryWhere(query: string): SQL | undefined {
  const condition = senderQueryWhere(query);
  return condition === undefined ? undefined : sql`not (${condition})`;
}

function textQueryWhere(expression: SQL, query: string): SQL | undefined {
  return andSql(
    ...wildcardPatterns(query).map((pattern) => sql`${expression} ilike ${pattern} escape '\\'`)
  );
}

function notTextQueryWhere(expression: SQL, query: string): SQL | undefined {
  const condition = textQueryWhere(expression, query);
  return condition === undefined ? undefined : sql`not (${condition})`;
}

function wildcardPatterns(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => `%${token.replace(/[\\%_]/g, '\\$&').replace(/\*/g, '%')}%`);
}

function messageListOrderBy(input: MessageListRead): SQL[] {
  if (input.order === undefined) {
    return [desc(telegramMessages.date), sql`${telegramMessages.id}::bigint desc`];
  }
  switch (input.order.key) {
    case 'date':
      return [
        ordered(telegramMessages.date, input.order.direction),
        ordered(sql`${telegramMessages.id}::bigint`, input.order.direction)
      ];
    case 'id':
      return [
        ordered(sql`${telegramMessages.id}::bigint`, input.order.direction),
        desc(telegramMessages.date)
      ];
    case 'text':
      return [
        ordered(messageTextExpression(), input.order.direction),
        desc(telegramMessages.date),
        sql`${telegramMessages.id}::bigint desc`
      ];
  }
}

function ordered(expression: Parameters<typeof asc>[0], direction: 'asc' | 'desc'): SQL {
  return direction === 'asc' ? asc(expression) : desc(expression);
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

function dateBound(value: Date | string | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value);
}

function messageReadStateWhere(readState: MessageListRead['readState']) {
  if (readState === undefined) {
    return undefined;
  }
  if (readState === 'unread') {
    return and(
      sql`coalesce(${telegramMessages.isOutgoing}, false) = false`,
      or(
        sql`${telegramChats.lastReadInboxMessageId} is null`,
        sql`${telegramMessages.id}::bigint > ${telegramChats.lastReadInboxMessageId}::bigint`
      )
    );
  }
  return or(
    eq(telegramMessages.isOutgoing, true),
    and(
      sql`${telegramChats.lastReadInboxMessageId} is not null`,
      sql`${telegramMessages.id}::bigint <= ${telegramChats.lastReadInboxMessageId}::bigint`
    )
  );
}
