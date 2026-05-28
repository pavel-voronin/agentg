import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';

import type { TelegramDatabase as AppDatabase } from '../database/client.js';
import {
  telegramChats,
  telegramHistoryCoverage,
  telegramHistoryLiveChats,
  telegramHistoryLiveWindows
} from '../database/schema.js';
import {
  normalizeTelegramHistoryInterval,
  TELEGRAM_HISTORY_TICK_MS,
  type TelegramHistoryInterval
} from './time.js';

export type TelegramHistoryCoverageInterval = TelegramHistoryInterval & {
  chatId: string;
};

export type TelegramHistoryCoverageSegment = TelegramHistoryCoverageInterval & {
  coveredAt: Date;
};

export type TelegramHistoryCoverageWriteSegment = TelegramHistoryCoverageInterval & {
  provedAt: Date;
};

export type TelegramHistoryCoverageWriteResult = {
  intervals: TelegramHistoryCoverageWriteSegment[];
};

export type TelegramHistoryCoverageMergePlan = {
  deleteIds: number[];
  inserts: TelegramHistoryCoverageSegment[];
  updates: {
    id: number;
    segment: TelegramHistoryCoverageSegment;
  }[];
};

type TelegramHistoryCoverageStorageRow = {
  coveredAt: Date;
  endAt: Date;
  id: number;
  startAt: Date;
  telegramChatId: string;
};

const coverageLocks = new Map<string, Promise<void>>();
const TELEGRAM_HISTORY_COVERAGE_BATCH_CHUNK_SIZE = 5000;

export async function listTelegramHistoryChatIds(database: AppDatabase): Promise<string[]> {
  const rows = await database
    .select({
      telegramChatId: telegramChats.id,
      type: sql<string>`case
        when ${telegramChats.type}->>'_' = 'chatTypePrivate' then 'private'
        when ${telegramChats.type}->>'_' = 'chatTypeSecret' then 'secret'
        when ${telegramChats.type}->>'_' = 'chatTypeBasicGroup' then 'group'
        when ${telegramChats.type}->>'_' = 'chatTypeSupergroup' and coalesce((${telegramChats.type}->>'is_channel')::boolean, false) then 'channel'
        when ${telegramChats.type}->>'_' = 'chatTypeSupergroup' then 'group'
        else coalesce(${telegramChats.type}->>'_', 'unknown')
      end`
    })
    .from(telegramChats)
    .orderBy(asc(telegramChats.id));

  return rows.filter((row) => isHistorySyncChatType(row.type)).map((row) => row.telegramChatId);
}

export async function listTelegramHistoryCoverage(
  database: AppDatabase,
  chatId: string
): Promise<TelegramHistoryCoverageSegment[]> {
  const [rows, liveSegments] = await Promise.all([
    database
      .select({
        coveredAt: telegramHistoryCoverage.coveredAt,
        endAt: telegramHistoryCoverage.endAt,
        startAt: telegramHistoryCoverage.startAt,
        telegramChatId: telegramHistoryCoverage.telegramChatId
      })
      .from(telegramHistoryCoverage)
      .where(eq(telegramHistoryCoverage.telegramChatId, chatId))
      .orderBy(asc(telegramHistoryCoverage.startAt)),
    listTelegramHistoryLiveCoverage(database, chatId)
  ]);

  return normalizeCoverageSegments([
    ...rows.map((row) => ({
      chatId: row.telegramChatId,
      coveredAt: row.coveredAt,
      endAt: row.endAt,
      startAt: row.startAt
    })),
    ...liveSegments
  ]);
}

export async function recoverTelegramHistoryLiveWindows(database: AppDatabase): Promise<void> {
  await database
    .update(telegramHistoryLiveWindows)
    .set({
      closedAt: sql`${telegramHistoryLiveWindows.endAt}`,
      closeReason: 'recovered_after_crash',
      updatedAt: sql`now()`
    })
    .where(isNull(telegramHistoryLiveWindows.closedAt));
}

export async function openTelegramHistoryLiveWindow(
  database: AppDatabase,
  startAt: Date
): Promise<number> {
  const [row] = await database
    .insert(telegramHistoryLiveWindows)
    .values({
      endAt: startAt,
      startAt,
      updatedAt: sql`now()`
    })
    .returning({
      id: telegramHistoryLiveWindows.id
    });

  if (row === undefined) {
    throw new Error('Telegram live coverage window insert returned no id');
  }

  return row.id;
}

export async function extendTelegramHistoryLiveWindow(
  database: AppDatabase,
  id: number,
  endAt: Date
): Promise<void> {
  await database
    .update(telegramHistoryLiveWindows)
    .set({
      endAt,
      updatedAt: sql`now()`
    })
    .where(
      and(
        eq(telegramHistoryLiveWindows.id, id),
        isNull(telegramHistoryLiveWindows.closedAt),
        lt(telegramHistoryLiveWindows.endAt, endAt)
      )
    );
}

export async function closeTelegramHistoryLiveWindow(
  database: AppDatabase,
  id: number,
  endAt: Date,
  closeReason: string
): Promise<void> {
  const durableEndAt = sql<Date>`greatest(${telegramHistoryLiveWindows.endAt}, ${endAt})`;
  await database
    .update(telegramHistoryLiveWindows)
    .set({
      closedAt: durableEndAt,
      closeReason,
      endAt: durableEndAt,
      updatedAt: sql`now()`
    })
    .where(and(eq(telegramHistoryLiveWindows.id, id), isNull(telegramHistoryLiveWindows.closedAt)));
}

export async function registerTelegramHistoryLiveChats(
  database: AppDatabase,
  chatIds: string[],
  eligibleFrom: Date
): Promise<void> {
  const uniqueChatIds = uniqueSortedStrings(chatIds);
  for (const chunk of chunks(uniqueChatIds, TELEGRAM_HISTORY_COVERAGE_BATCH_CHUNK_SIZE)) {
    if (chunk.length > 0) {
      await database
        .insert(telegramHistoryLiveChats)
        .values(
          chunk.map((chatId) => ({
            eligibleFrom,
            telegramChatId: chatId,
            updatedAt: sql`now()`
          }))
        )
        .onConflictDoNothing({
          target: telegramHistoryLiveChats.telegramChatId
        });
    }
  }
}

async function listTelegramHistoryLiveCoverage(
  database: AppDatabase,
  chatId: string
): Promise<TelegramHistoryCoverageSegment[]> {
  const [liveChat] = await database
    .select({
      eligibleFrom: telegramHistoryLiveChats.eligibleFrom
    })
    .from(telegramHistoryLiveChats)
    .where(eq(telegramHistoryLiveChats.telegramChatId, chatId))
    .limit(1);

  if (liveChat === undefined) {
    return [];
  }

  const rows = await database
    .select({
      endAt: telegramHistoryLiveWindows.endAt,
      startAt: telegramHistoryLiveWindows.startAt
    })
    .from(telegramHistoryLiveWindows)
    .where(gt(telegramHistoryLiveWindows.endAt, liveChat.eligibleFrom))
    .orderBy(asc(telegramHistoryLiveWindows.startAt));

  return rows
    .map((row) => ({
      chatId,
      coveredAt: row.endAt,
      endAt: row.endAt,
      startAt: maxDate(row.startAt, liveChat.eligibleFrom)
    }))
    .filter((segment) => segment.startAt < segment.endAt);
}

export async function addTelegramHistoryCoverage(
  database: AppDatabase,
  interval: TelegramHistoryCoverageInterval,
  options: { provedAt?: Date } = {}
): Promise<TelegramHistoryCoverageWriteResult> {
  return addTelegramHistoryCoverageBatch(database, [interval], options);
}

export async function addTelegramHistoryCoverageBatch(
  database: AppDatabase,
  intervals: TelegramHistoryCoverageInterval[],
  options: { provedAt?: Date } = {}
): Promise<TelegramHistoryCoverageWriteResult> {
  const coverageSegments = normalizeCoverageWriteInput(intervals, options.provedAt ?? new Date());
  if (coverageSegments.length === 0) {
    return { intervals: [] };
  }

  await withTelegramHistoryCoverageLocks(
    uniqueSortedStrings(coverageSegments.map((row) => row.chatId)),
    async () =>
      database.transaction(async (transaction) => {
        await writeTelegramHistoryCoverageInTransaction(transaction, coverageSegments);
      })
  );

  return { intervals: coverageSegments };
}

export async function writeTelegramHistoryCoverageInTransaction(
  database: AppDatabase,
  coverageSegments: TelegramHistoryCoverageWriteSegment[]
): Promise<void> {
  const normalizedSegments = normalizeCoverageWriteSegments(coverageSegments);
  if (normalizedSegments.length === 0) {
    return;
  }

  await mergeOperationalCoverageInTransaction(database, normalizedSegments);
}

export function normalizeCoverageWriteInput(
  intervals: TelegramHistoryCoverageInterval[],
  provedAt: Date
): TelegramHistoryCoverageWriteSegment[] {
  return normalizeCoverageWriteSegments(
    intervals.map((interval) => ({
      ...interval,
      provedAt
    }))
  );
}

export function normalizeCoverageSegments(
  segments: TelegramHistoryCoverageSegment[]
): TelegramHistoryCoverageSegment[] {
  const byChat = groupBy(segments, (segment) => segment.chatId);
  return [...byChat.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([chatId, chatSegments]) => mergeCoverageSegmentsForChat(chatId, chatSegments));
}

function normalizeCoverageWriteSegments(
  segments: TelegramHistoryCoverageWriteSegment[]
): TelegramHistoryCoverageWriteSegment[] {
  const byChat = groupBy(segments, (segment) => segment.chatId);
  return [...byChat.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([chatId, chatSegments]) => mergeCoverageWriteSegmentsForChat(chatId, chatSegments));
}

export function subtractTelegramHistoryIntervals(
  desiredIntervals: TelegramHistoryInterval[],
  coverageIntervals: TelegramHistoryInterval[]
): TelegramHistoryInterval[] {
  const desired = mergeIntervals(desiredIntervals);
  const coverage = mergeIntervals(coverageIntervals);
  const missing: TelegramHistoryInterval[] = [];

  for (const desiredInterval of desired) {
    let cursor = desiredInterval.startAt;

    for (const coveredInterval of coverage) {
      if (coveredInterval.endAt <= cursor) {
        continue;
      }

      if (coveredInterval.startAt >= desiredInterval.endAt) {
        break;
      }

      if (coveredInterval.startAt > cursor) {
        missing.push({
          endAt: minDate(coveredInterval.startAt, desiredInterval.endAt),
          startAt: cursor
        });
      }

      if (coveredInterval.endAt > cursor) {
        cursor = maxDate(cursor, coveredInterval.endAt);
      }

      if (cursor >= desiredInterval.endAt) {
        break;
      }
    }

    if (cursor < desiredInterval.endAt) {
      missing.push({
        endAt: desiredInterval.endAt,
        startAt: cursor
      });
    }
  }

  return missing;
}

export function orderTelegramHistoryIntervalsClosestToPresent(
  intervals: TelegramHistoryInterval[]
): TelegramHistoryInterval[] {
  return [...intervals].sort((first, second) => {
    const endDifference = second.endAt.getTime() - first.endAt.getTime();
    return endDifference === 0 ? second.startAt.getTime() - first.startAt.getTime() : endDifference;
  });
}

export async function withTelegramHistoryCoverageLocks<T>(
  chatIds: string[],
  operation: () => Promise<T>,
  index = 0
): Promise<T> {
  const chatId = chatIds[index];
  if (chatId === undefined) {
    return operation();
  }
  return withTelegramHistoryCoverageLock(chatId, () =>
    withTelegramHistoryCoverageLocks(chatIds, operation, index + 1)
  );
}

async function mergeOperationalCoverageInTransaction(
  database: AppDatabase,
  coverageSegments: TelegramHistoryCoverageWriteSegment[]
): Promise<void> {
  const intervalsByChat = groupBy(coverageSegments, (segment) => segment.chatId);

  for (const [chatId, chatSegments] of intervalsByChat.entries()) {
    const searchStartAt = new Date(
      minDateFromList(chatSegments.map((segment) => segment.startAt)).getTime() -
        TELEGRAM_HISTORY_TICK_MS
    );
    const searchEndAt = new Date(
      maxDateFromList(chatSegments.map((segment) => segment.endAt)).getTime() +
        TELEGRAM_HISTORY_TICK_MS
    );
    const overlappingRows = await database
      .select({
        coveredAt: telegramHistoryCoverage.coveredAt,
        endAt: telegramHistoryCoverage.endAt,
        id: telegramHistoryCoverage.id,
        startAt: telegramHistoryCoverage.startAt,
        telegramChatId: telegramHistoryCoverage.telegramChatId
      })
      .from(telegramHistoryCoverage)
      .where(
        and(
          eq(telegramHistoryCoverage.telegramChatId, chatId),
          lte(telegramHistoryCoverage.startAt, searchEndAt),
          gte(telegramHistoryCoverage.endAt, searchStartAt)
        )
      );
    const mergedSegments = normalizeCoverageSegments([
      ...overlappingRows.map((row) => ({
        chatId: row.telegramChatId,
        coveredAt: row.coveredAt,
        endAt: row.endAt,
        startAt: row.startAt
      })),
      ...chatSegments.map((segment) => ({
        chatId,
        coveredAt: segment.provedAt,
        endAt: segment.endAt,
        startAt: segment.startAt
      }))
    ]);

    await applyCoverageMergePlan(
      database,
      planTelegramHistoryCoverageMerge(overlappingRows, mergedSegments)
    );
  }
}

export function planTelegramHistoryCoverageMerge(
  existingRows: TelegramHistoryCoverageStorageRow[],
  mergedSegments: TelegramHistoryCoverageSegment[]
): TelegramHistoryCoverageMergePlan {
  const reusableRows = [...existingRows].sort(compareCoverageRowStart);
  const updates: TelegramHistoryCoverageMergePlan['updates'] = [];
  const updateCount = Math.min(reusableRows.length, mergedSegments.length);

  for (let index = 0; index < updateCount; index += 1) {
    const row = reusableRows[index];
    const segment = mergedSegments[index];
    if (row === undefined || segment === undefined || coverageRowMatchesSegment(row, segment)) {
      continue;
    }
    updates.push({
      id: row.id,
      segment
    });
  }

  const inserts = mergedSegments.slice(reusableRows.length);
  const deleteIds = reusableRows.slice(mergedSegments.length).map((row) => row.id);

  return {
    deleteIds,
    inserts,
    updates
  };
}

async function applyCoverageMergePlan(
  database: AppDatabase,
  plan: TelegramHistoryCoverageMergePlan
): Promise<void> {
  await updateCoverageRows(database, plan.updates);
  await insertCoverageSegments(database, plan.inserts);
  await deleteCoverageRows(database, plan.deleteIds);
}

async function updateCoverageRows(
  database: AppDatabase,
  updates: TelegramHistoryCoverageMergePlan['updates']
): Promise<void> {
  for (const update of updates) {
    await database
      .update(telegramHistoryCoverage)
      .set({
        coveredAt: update.segment.coveredAt,
        endAt: update.segment.endAt,
        startAt: update.segment.startAt,
        telegramChatId: update.segment.chatId,
        updatedAt: sql`now()`
      })
      .where(eq(telegramHistoryCoverage.id, update.id));
  }
}

async function deleteCoverageRows(database: AppDatabase, ids: number[]): Promise<void> {
  for (const chunk of chunks(ids, TELEGRAM_HISTORY_COVERAGE_BATCH_CHUNK_SIZE)) {
    if (chunk.length > 0) {
      await database
        .delete(telegramHistoryCoverage)
        .where(inArray(telegramHistoryCoverage.id, chunk));
    }
  }
}

async function insertCoverageSegments(
  database: AppDatabase,
  segments: TelegramHistoryCoverageSegment[]
): Promise<void> {
  for (const values of chunks(segments, TELEGRAM_HISTORY_COVERAGE_BATCH_CHUNK_SIZE)) {
    if (values.length > 0) {
      await database.insert(telegramHistoryCoverage).values(
        values.map((segment) => ({
          coveredAt: segment.coveredAt,
          endAt: segment.endAt,
          startAt: segment.startAt,
          telegramChatId: segment.chatId,
          updatedAt: sql`now()`
        }))
      );
    }
  }
}

function mergeCoverageSegmentsForChat(
  chatId: string,
  segments: TelegramHistoryCoverageSegment[]
): TelegramHistoryCoverageSegment[] {
  const sorted = segments
    .map((segment) => normalizeTelegramHistoryInterval(segment))
    .filter((segment) => segment.startAt < segment.endAt)
    .sort(compareIntervalStart);
  const merged: TelegramHistoryCoverageSegment[] = [];

  for (const segment of sorted) {
    const last = merged.at(-1);
    if (
      last === undefined ||
      segment.startAt.getTime() > last.endAt.getTime() + TELEGRAM_HISTORY_TICK_MS
    ) {
      merged.push({ ...segment, chatId });
      continue;
    }

    if (segment.endAt > last.endAt) {
      last.endAt = segment.endAt;
    }
    if (segment.coveredAt > last.coveredAt) {
      last.coveredAt = segment.coveredAt;
    }
  }

  return merged;
}

function mergeCoverageWriteSegmentsForChat(
  chatId: string,
  segments: TelegramHistoryCoverageWriteSegment[]
): TelegramHistoryCoverageWriteSegment[] {
  const sorted = segments
    .map((segment) => normalizeTelegramHistoryInterval(segment))
    .filter((segment) => segment.startAt < segment.endAt)
    .sort(compareIntervalStart);
  const merged: TelegramHistoryCoverageWriteSegment[] = [];

  for (const segment of sorted) {
    const last = merged.at(-1);
    if (
      last === undefined ||
      segment.startAt > last.endAt ||
      segment.provedAt.getTime() !== last.provedAt.getTime()
    ) {
      merged.push({ ...segment, chatId });
      continue;
    }

    if (segment.endAt > last.endAt) {
      last.endAt = segment.endAt;
    }
  }

  return merged;
}

function mergeIntervals(intervals: TelegramHistoryInterval[]): TelegramHistoryInterval[] {
  const sorted = intervals
    .map(normalizeTelegramHistoryInterval)
    .filter((interval) => interval.startAt < interval.endAt)
    .sort(compareIntervalStart);
  const merged: TelegramHistoryInterval[] = [];

  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last === undefined || interval.startAt > last.endAt) {
      merged.push({ ...interval });
      continue;
    }

    if (interval.endAt > last.endAt) {
      last.endAt = interval.endAt;
    }
  }

  return merged;
}

function compareIntervalStart(
  first: TelegramHistoryInterval,
  second: TelegramHistoryInterval
): number {
  const startDifference = first.startAt.getTime() - second.startAt.getTime();
  return startDifference === 0 ? first.endAt.getTime() - second.endAt.getTime() : startDifference;
}

function compareCoverageRowStart(
  first: TelegramHistoryCoverageStorageRow,
  second: TelegramHistoryCoverageStorageRow
): number {
  const intervalDifference = compareIntervalStart(first, second);
  return intervalDifference === 0 ? first.id - second.id : intervalDifference;
}

function coverageRowMatchesSegment(
  row: TelegramHistoryCoverageStorageRow,
  segment: TelegramHistoryCoverageSegment
): boolean {
  return (
    row.telegramChatId === segment.chatId &&
    row.startAt.getTime() === segment.startAt.getTime() &&
    row.endAt.getTime() === segment.endAt.getTime()
  );
}

function minDate(first: Date, second: Date): Date {
  return first < second ? first : second;
}

function maxDate(first: Date, second: Date): Date {
  return first > second ? first : second;
}

function minDateFromList(dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('minDateFromList requires at least one date');
  }
  return rest.reduce((minimum, date) => (date < minimum ? date : minimum), first);
}

function maxDateFromList(dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('maxDateFromList requires at least one date');
  }
  return rest.reduce((maximum, date) => (date > maximum ? date : maximum), first);
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function groupBy<T, K>(items: T[], keyForItem: (item: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const item of items) {
    const key = keyForItem(item);
    const existing = grouped.get(key);
    if (existing === undefined) {
      grouped.set(key, [item]);
    } else {
      existing.push(item);
    }
  }
  return grouped;
}

async function withTelegramHistoryCoverageLock<T>(
  chatId: string,
  operation: () => Promise<T>
): Promise<T> {
  const previous = coverageLocks.get(chatId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const lock = current.then(
    () => undefined,
    () => undefined
  );
  coverageLocks.set(chatId, lock);

  try {
    return await current;
  } finally {
    if (coverageLocks.get(chatId) === lock) {
      coverageLocks.delete(chatId);
    }
  }
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function isHistorySyncChatType(type: string): boolean {
  return type === 'private' || type === 'secret' || type === 'group' || type === 'channel';
}
