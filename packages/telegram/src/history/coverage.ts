import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramChats,
  telegramHistoryCoverage,
  telegramHistoryLiveChats,
  telegramHistoryLiveWindows
} from '../database/schema.js';
import { normalizeHistoryInterval, HISTORY_TICK_MS, type HistoryInterval } from './time.js';

// TODO(file-size): Split storage reads, live windows, locks, and merge planning.
export type HistoryCoverageInterval = HistoryInterval & {
  chatId: string;
  ownerKey?: string;
  ownerKind?: string;
};

export type HistoryCoverageSegment = HistoryCoverageInterval & {
  coveredAt: Date;
};

export type HistoryCoverageWriteSegment = HistoryCoverageInterval & {
  provedAt: Date;
};

export type HistoryCoverageWriteResult = {
  intervals: HistoryCoverageWriteSegment[];
};

export type HistoryCoverageMergePlan = {
  deleteIds: number[];
  inserts: HistoryCoverageSegment[];
  updates: {
    id: number;
    segment: HistoryCoverageSegment;
  }[];
};

type HistoryCoverageStorageRow = {
  coveredAt: Date;
  endAt: Date;
  id: number;
  ownerKey: string;
  ownerKind: string;
  startAt: Date;
  telegramChatId: string | null;
};

const coverageLocks = new Map<string, Promise<void>>();
const HISTORY_COVERAGE_BATCH_CHUNK_SIZE = 5000;

export async function listHistoryChatIds(database: Database): Promise<string[]> {
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

  return rows.filter((row) => isHistoryCoverageChatType(row.type)).map((row) => row.telegramChatId);
}

export async function listHistoryCoverage(
  database: Database,
  chatId: string
): Promise<HistoryCoverageSegment[]> {
  const [rows, liveSegments] = await Promise.all([
    database
      .select({
        coveredAt: telegramHistoryCoverage.coveredAt,
        endAt: telegramHistoryCoverage.endAt,
        ownerKey: telegramHistoryCoverage.ownerKey,
        ownerKind: telegramHistoryCoverage.ownerKind,
        startAt: telegramHistoryCoverage.startAt,
        telegramChatId: telegramHistoryCoverage.telegramChatId
      })
      .from(telegramHistoryCoverage)
      .where(eq(telegramHistoryCoverage.ownerKey, chatOwnerKey(chatId)))
      .orderBy(asc(telegramHistoryCoverage.startAt)),
    listHistoryLiveCoverage(database, chatId)
  ]);

  return normalizeCoverageSegments([
    ...rows.map((row) => ({
      chatId: row.telegramChatId ?? chatId,
      coveredAt: row.coveredAt,
      endAt: row.endAt,
      ownerKey: row.ownerKey,
      ownerKind: row.ownerKind,
      startAt: row.startAt
    })),
    ...liveSegments
  ]);
}

export async function recoverHistoryLiveWindows(database: Database): Promise<void> {
  await database
    .update(telegramHistoryLiveWindows)
    .set({
      closedAt: sql`${telegramHistoryLiveWindows.endAt}`,
      closeReason: 'recovered_after_crash',
      updatedAt: sql`now()`
    })
    .where(isNull(telegramHistoryLiveWindows.closedAt));
}

export async function openHistoryLiveWindow(database: Database, startAt: Date): Promise<number> {
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
    throw new Error('Live coverage window insert returned no id');
  }

  return row.id;
}

export async function extendHistoryLiveWindow(
  database: Database,
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

export async function closeHistoryLiveWindow(
  database: Database,
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

export async function registerHistoryLiveChats(
  database: Database,
  chatIds: string[],
  eligibleFrom: Date
): Promise<void> {
  const uniqueChatIds = uniqueSortedStrings(chatIds);
  for (const chunk of chunks(uniqueChatIds, HISTORY_COVERAGE_BATCH_CHUNK_SIZE)) {
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

async function listHistoryLiveCoverage(
  database: Database,
  chatId: string
): Promise<HistoryCoverageSegment[]> {
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
      ownerKey: chatOwnerKey(chatId),
      ownerKind: 'chat',
      startAt: maxDate(row.startAt, liveChat.eligibleFrom)
    }))
    .filter((segment) => segment.startAt < segment.endAt);
}

export async function addHistoryCoverage(
  database: Database,
  interval: HistoryCoverageInterval,
  options: { provedAt?: Date } = {}
): Promise<HistoryCoverageWriteResult> {
  return addHistoryCoverageBatch(database, [interval], options);
}

export async function addHistoryCoverageBatch(
  database: Database,
  intervals: HistoryCoverageInterval[],
  options: { provedAt?: Date } = {}
): Promise<HistoryCoverageWriteResult> {
  const coverageSegments = normalizeCoverageWriteInput(intervals, options.provedAt ?? new Date());
  if (coverageSegments.length === 0) {
    return { intervals: [] };
  }

  await withHistoryCoverageLocks(
    uniqueSortedStrings(coverageSegments.map(coverageOwnerKey)),
    async () =>
      database.transaction(async (transaction) => {
        await writeHistoryCoverageInTransaction(transaction, coverageSegments);
      })
  );

  return { intervals: coverageSegments };
}

export async function writeHistoryCoverageInTransaction(
  database: Database,
  coverageSegments: HistoryCoverageWriteSegment[]
): Promise<void> {
  const normalizedSegments = normalizeCoverageWriteSegments(coverageSegments);
  if (normalizedSegments.length === 0) {
    return;
  }

  await mergeOperationalCoverageInTransaction(database, normalizedSegments);
}

export function normalizeCoverageWriteInput(
  intervals: HistoryCoverageInterval[],
  provedAt: Date
): HistoryCoverageWriteSegment[] {
  return normalizeCoverageWriteSegments(
    intervals.map((interval) => ({
      ...interval,
      provedAt
    }))
  );
}

export function normalizeCoverageSegments(
  segments: HistoryCoverageSegment[]
): HistoryCoverageSegment[] {
  const byOwner = groupBy(segments, coverageOwnerKey);
  return [...byOwner.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([, ownerSegments]) => mergeCoverageSegmentsForOwner(ownerSegments));
}

function normalizeCoverageWriteSegments(
  segments: HistoryCoverageWriteSegment[]
): HistoryCoverageWriteSegment[] {
  const byOwner = groupBy(segments, coverageOwnerKey);
  return [...byOwner.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([, ownerSegments]) => mergeCoverageWriteSegmentsForOwner(ownerSegments));
}

export function subtractHistoryIntervals(
  desiredIntervals: HistoryInterval[],
  coverageIntervals: HistoryInterval[]
): HistoryInterval[] {
  const desired = mergeIntervals(desiredIntervals);
  const coverage = mergeIntervals(coverageIntervals);
  const missing: HistoryInterval[] = [];

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

export function orderHistoryIntervalsClosestToPresent(
  intervals: HistoryInterval[]
): HistoryInterval[] {
  return [...intervals].sort((first, second) => {
    const endDifference = second.endAt.getTime() - first.endAt.getTime();
    return endDifference === 0 ? second.startAt.getTime() - first.startAt.getTime() : endDifference;
  });
}

export async function withHistoryCoverageLocks<T>(
  chatIds: string[],
  operation: () => Promise<T>,
  index = 0
): Promise<T> {
  const chatId = chatIds[index];
  if (chatId === undefined) {
    return operation();
  }
  return withHistoryCoverageLock(chatId, () =>
    withHistoryCoverageLocks(chatIds, operation, index + 1)
  );
}

async function mergeOperationalCoverageInTransaction(
  database: Database,
  coverageSegments: HistoryCoverageWriteSegment[]
): Promise<void> {
  const intervalsByOwner = groupBy(coverageSegments, coverageOwnerKey);

  for (const [ownerKey, ownerSegments] of intervalsByOwner.entries()) {
    const searchStartAt = new Date(
      minDateFromList(ownerSegments.map((segment) => segment.startAt)).getTime() - HISTORY_TICK_MS
    );
    const searchEndAt = new Date(
      maxDateFromList(ownerSegments.map((segment) => segment.endAt)).getTime() + HISTORY_TICK_MS
    );
    const overlappingRows = await database
      .select({
        coveredAt: telegramHistoryCoverage.coveredAt,
        endAt: telegramHistoryCoverage.endAt,
        id: telegramHistoryCoverage.id,
        ownerKey: telegramHistoryCoverage.ownerKey,
        ownerKind: telegramHistoryCoverage.ownerKind,
        startAt: telegramHistoryCoverage.startAt,
        telegramChatId: telegramHistoryCoverage.telegramChatId
      })
      .from(telegramHistoryCoverage)
      .where(
        and(
          eq(telegramHistoryCoverage.ownerKey, ownerKey),
          lte(telegramHistoryCoverage.startAt, searchEndAt),
          gte(telegramHistoryCoverage.endAt, searchStartAt)
        )
      );
    const mergedSegments = normalizeCoverageSegments([
      ...overlappingRows.map((row) => ({
        chatId: row.telegramChatId ?? ownerSegments[0]?.chatId ?? '',
        coveredAt: row.coveredAt,
        endAt: row.endAt,
        ownerKey: row.ownerKey,
        ownerKind: row.ownerKind,
        startAt: row.startAt
      })),
      ...ownerSegments.map((segment) => ({
        chatId: segment.chatId,
        coveredAt: segment.provedAt,
        endAt: segment.endAt,
        ownerKey: coverageOwnerKey(segment),
        ownerKind: coverageOwnerKind(segment),
        startAt: segment.startAt
      }))
    ]);

    await applyCoverageMergePlan(
      database,
      planHistoryCoverageMerge(overlappingRows, mergedSegments)
    );
  }
}

export function planHistoryCoverageMerge(
  existingRows: HistoryCoverageStorageRow[],
  mergedSegments: HistoryCoverageSegment[]
): HistoryCoverageMergePlan {
  const reusableRows = [...existingRows].sort(compareCoverageRowStart);
  const updates: HistoryCoverageMergePlan['updates'] = [];
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
  database: Database,
  plan: HistoryCoverageMergePlan
): Promise<void> {
  await updateCoverageRows(database, plan.updates);
  await insertCoverageSegments(database, plan.inserts);
  await deleteCoverageRows(database, plan.deleteIds);
}

async function updateCoverageRows(
  database: Database,
  updates: HistoryCoverageMergePlan['updates']
): Promise<void> {
  for (const update of updates) {
    await database
      .update(telegramHistoryCoverage)
      .set({
        coveredAt: update.segment.coveredAt,
        endAt: update.segment.endAt,
        ownerKey: coverageOwnerKey(update.segment),
        ownerKind: coverageOwnerKind(update.segment),
        startAt: update.segment.startAt,
        telegramChatId: update.segment.chatId,
        updatedAt: sql`now()`
      })
      .where(eq(telegramHistoryCoverage.id, update.id));
  }
}

async function deleteCoverageRows(database: Database, ids: number[]): Promise<void> {
  for (const chunk of chunks(ids, HISTORY_COVERAGE_BATCH_CHUNK_SIZE)) {
    if (chunk.length > 0) {
      await database
        .delete(telegramHistoryCoverage)
        .where(inArray(telegramHistoryCoverage.id, chunk));
    }
  }
}

async function insertCoverageSegments(
  database: Database,
  segments: HistoryCoverageSegment[]
): Promise<void> {
  for (const values of chunks(segments, HISTORY_COVERAGE_BATCH_CHUNK_SIZE)) {
    if (values.length > 0) {
      await database.insert(telegramHistoryCoverage).values(
        values.map((segment) => ({
          coveredAt: segment.coveredAt,
          endAt: segment.endAt,
          ownerKey: coverageOwnerKey(segment),
          ownerKind: coverageOwnerKind(segment),
          startAt: segment.startAt,
          telegramChatId: segment.chatId,
          updatedAt: sql`now()`
        }))
      );
    }
  }
}

function mergeCoverageSegmentsForOwner(
  segments: HistoryCoverageSegment[]
): HistoryCoverageSegment[] {
  const sorted = segments
    .map((segment) => normalizeHistoryInterval(segment))
    .filter((segment) => segment.startAt < segment.endAt)
    .sort(compareIntervalStart);
  const merged: HistoryCoverageSegment[] = [];

  for (const segment of sorted) {
    const last = merged.at(-1);
    if (last === undefined || segment.startAt.getTime() > last.endAt.getTime() + HISTORY_TICK_MS) {
      merged.push({ ...segment });
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

function mergeCoverageWriteSegmentsForOwner(
  segments: HistoryCoverageWriteSegment[]
): HistoryCoverageWriteSegment[] {
  const sorted = segments
    .map((segment) => normalizeHistoryInterval(segment))
    .filter((segment) => segment.startAt < segment.endAt)
    .sort(compareIntervalStart);
  const merged: HistoryCoverageWriteSegment[] = [];

  for (const segment of sorted) {
    const last = merged.at(-1);
    if (
      last === undefined ||
      segment.startAt > last.endAt ||
      segment.provedAt.getTime() !== last.provedAt.getTime()
    ) {
      merged.push({ ...segment });
      continue;
    }

    if (segment.endAt > last.endAt) {
      last.endAt = segment.endAt;
    }
  }

  return merged;
}

function mergeIntervals(intervals: HistoryInterval[]): HistoryInterval[] {
  const sorted = intervals
    .map(normalizeHistoryInterval)
    .filter((interval) => interval.startAt < interval.endAt)
    .sort(compareIntervalStart);
  const merged: HistoryInterval[] = [];

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

function compareIntervalStart(first: HistoryInterval, second: HistoryInterval): number {
  const startDifference = first.startAt.getTime() - second.startAt.getTime();
  return startDifference === 0 ? first.endAt.getTime() - second.endAt.getTime() : startDifference;
}

function compareCoverageRowStart(
  first: HistoryCoverageStorageRow,
  second: HistoryCoverageStorageRow
): number {
  const intervalDifference = compareIntervalStart(first, second);
  return intervalDifference === 0 ? first.id - second.id : intervalDifference;
}

function coverageRowMatchesSegment(
  row: HistoryCoverageStorageRow,
  segment: HistoryCoverageSegment
): boolean {
  return (
    row.telegramChatId === segment.chatId &&
    row.ownerKey === coverageOwnerKey(segment) &&
    row.ownerKind === coverageOwnerKind(segment) &&
    row.startAt.getTime() === segment.startAt.getTime() &&
    row.endAt.getTime() === segment.endAt.getTime()
  );
}

function chatOwnerKey(chatId: string): string {
  return `chat:${chatId}`;
}

function coverageOwnerKey(segment: HistoryCoverageInterval): string {
  return segment.ownerKey ?? chatOwnerKey(segment.chatId);
}

function coverageOwnerKind(segment: HistoryCoverageInterval): string {
  return segment.ownerKind ?? 'chat';
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

async function withHistoryCoverageLock<T>(chatId: string, operation: () => Promise<T>): Promise<T> {
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

function isHistoryCoverageChatType(type: string): boolean {
  return type === 'private' || type === 'secret' || type === 'group' || type === 'channel';
}
