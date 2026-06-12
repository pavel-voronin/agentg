import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';

import type { Database } from '../../database/client.js';
import { telegramMessages } from '../../database/schema.js';
import { HISTORY_TICK_MS } from '../../history/time.js';
import { ownerMessageCondition, parseTdlibInt53 } from '../../reconciler/owner.js';
import {
  readMessageSelection,
  toReadMessages,
  type MessageStorageRow
} from '../../views/message.js';
import type { MessageOwner, PageSelector, RangeSelector } from './contract.js';

export async function readPageRows(
  database: Database,
  owner: MessageOwner,
  selector: PageSelector
): Promise<MessageStorageRow[]> {
  const before =
    selector.beforeMessageId === undefined
      ? undefined
      : parseTdlibInt53(selector.beforeMessageId, 'beforeMessageId');
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

  return [...rows].reverse();
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

  return database
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

export async function toOutputMessages(
  database: Database,
  rows: MessageStorageRow[]
): Promise<Awaited<ReturnType<typeof toReadMessages>>> {
  return toReadMessages(database, rows);
}

function messageChatCondition(owner: MessageOwner) {
  return owner.kind === 'savedMessagesTopic'
    ? undefined
    : eq(telegramMessages.chatId, owner.chatId);
}

function nextHistorySecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / HISTORY_TICK_MS) * HISTORY_TICK_MS + HISTORY_TICK_MS);
}
