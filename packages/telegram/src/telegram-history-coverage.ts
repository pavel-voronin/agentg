import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import type { TelegramDatabase as AppDatabase } from './database.js';
import { telegramChats, telegramHistoryCoverage, telegramHistoryCoverageProofs } from './schema.js';
import {
  normalizeTelegramHistoryInterval,
  TELEGRAM_HISTORY_TICK_MS,
  type TelegramHistoryInterval
} from './telegram-history-time.js';

export type TelegramHistoryCoverageInterval = TelegramHistoryInterval & {
  chatId: string;
};

export type TelegramHistoryCoverageSegment = TelegramHistoryCoverageInterval & {
  coveredAt: Date;
};

export type TelegramHistoryCoverageProofSegment = TelegramHistoryCoverageInterval & {
  provedAt: Date;
};

export type TelegramHistoryCoverageWriteResult = {
  intervals: TelegramHistoryCoverageProofSegment[];
};

const coverageLocks = new Map<string, Promise<void>>();
const TELEGRAM_HISTORY_COVERAGE_BATCH_CHUNK_SIZE = 5000;

export async function listTelegramHistoryChatIds(database: AppDatabase): Promise<string[]> {
  const rows = await database
    .select({
      telegramChatId: telegramChats.telegramChatId,
      type: telegramChats.type
    })
    .from(telegramChats)
    .orderBy(asc(telegramChats.telegramChatId));

  return rows.filter((row) => isHistorySyncChatType(row.type)).map((row) => row.telegramChatId);
}

export async function listTelegramHistoryCoverage(
  database: AppDatabase,
  chatId: string
): Promise<TelegramHistoryCoverageSegment[]> {
  const rows = await database
    .select({
      coveredAt: telegramHistoryCoverage.coveredAt,
      endAt: telegramHistoryCoverage.endAt,
      startAt: telegramHistoryCoverage.startAt,
      telegramChatId: telegramHistoryCoverage.telegramChatId
    })
    .from(telegramHistoryCoverage)
    .where(eq(telegramHistoryCoverage.telegramChatId, chatId))
    .orderBy(asc(telegramHistoryCoverage.startAt));

  return normalizeCoverageSegments(
    rows.map((row) => ({
      chatId: row.telegramChatId,
      coveredAt: row.coveredAt,
      endAt: row.endAt,
      startAt: row.startAt
    }))
  );
}

export async function listTelegramHistoryCoverageProofs(
  database: AppDatabase,
  chatId: string
): Promise<TelegramHistoryCoverageProofSegment[]> {
  const rows = await database
    .select({
      endAt: telegramHistoryCoverageProofs.endAt,
      provedAt: telegramHistoryCoverageProofs.provedAt,
      startAt: telegramHistoryCoverageProofs.startAt,
      telegramChatId: telegramHistoryCoverageProofs.telegramChatId
    })
    .from(telegramHistoryCoverageProofs)
    .where(eq(telegramHistoryCoverageProofs.telegramChatId, chatId))
    .orderBy(asc(telegramHistoryCoverageProofs.startAt));

  return normalizeProofSegments(
    rows.map((row) => ({
      chatId: row.telegramChatId,
      endAt: row.endAt,
      provedAt: row.provedAt,
      startAt: row.startAt
    }))
  );
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
  const proofSegments = normalizeCoverageWriteInput(intervals, options.provedAt ?? new Date());
  if (proofSegments.length === 0) {
    return { intervals: [] };
  }

  await withTelegramHistoryCoverageLocks(
    uniqueSortedStrings(proofSegments.map((row) => row.chatId)),
    async () =>
      database.transaction(async (transaction) => {
        await writeTelegramHistoryCoverageInTransaction(transaction, proofSegments);
      })
  );

  return { intervals: proofSegments };
}

export async function writeTelegramHistoryCoverageInTransaction(
  database: AppDatabase,
  proofSegments: TelegramHistoryCoverageProofSegment[]
): Promise<void> {
  const normalizedProofs = normalizeProofSegments(proofSegments);
  if (normalizedProofs.length === 0) {
    return;
  }

  await mergeOperationalCoverageInTransaction(database, normalizedProofs);
  await repaintCoverageProofsInTransaction(database, normalizedProofs);
}

export function normalizeCoverageWriteInput(
  intervals: TelegramHistoryCoverageInterval[],
  provedAt: Date
): TelegramHistoryCoverageProofSegment[] {
  return normalizeProofSegments(
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

export function normalizeProofSegments(
  segments: TelegramHistoryCoverageProofSegment[]
): TelegramHistoryCoverageProofSegment[] {
  const byChat = groupBy(segments, (segment) => segment.chatId);
  return [...byChat.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([chatId, chatSegments]) => mergeProofSegmentsForChat(chatId, chatSegments));
}

export function repaintTelegramHistoryCoverageProofs(
  existingSegments: TelegramHistoryCoverageProofSegment[],
  newSegments: TelegramHistoryCoverageProofSegment[]
): TelegramHistoryCoverageProofSegment[] {
  let result = normalizeProofSegments(existingSegments);

  for (const segment of normalizeProofSegments(newSegments)) {
    const next: TelegramHistoryCoverageProofSegment[] = [];

    for (const existing of result) {
      if (existing.chatId !== segment.chatId || !intervalsOverlap(existing, segment)) {
        next.push(existing);
        continue;
      }

      if (existing.startAt < segment.startAt) {
        next.push({
          ...existing,
          endAt: segment.startAt
        });
      }
      if (existing.endAt > segment.endAt) {
        next.push({
          ...existing,
          startAt: segment.endAt
        });
      }
    }

    next.push(segment);
    result = normalizeProofSegments(next);
  }

  return result;
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
  proofSegments: TelegramHistoryCoverageProofSegment[]
): Promise<void> {
  const intervalsByChat = groupBy(proofSegments, (segment) => segment.chatId);

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

    await deleteCoverageRows(
      database,
      overlappingRows.map((row) => row.id)
    );
    await insertCoverageSegments(database, mergedSegments);
  }
}

async function repaintCoverageProofsInTransaction(
  database: AppDatabase,
  proofSegments: TelegramHistoryCoverageProofSegment[]
): Promise<void> {
  const intervalsByChat = groupBy(proofSegments, (segment) => segment.chatId);

  for (const [chatId, chatSegments] of intervalsByChat.entries()) {
    const searchStartAt = new Date(
      minDateFromList(chatSegments.map((segment) => segment.startAt)).getTime() -
        TELEGRAM_HISTORY_TICK_MS
    );
    const searchEndAt = new Date(
      maxDateFromList(chatSegments.map((segment) => segment.endAt)).getTime() +
        TELEGRAM_HISTORY_TICK_MS
    );
    const existingRows = await database
      .select({
        endAt: telegramHistoryCoverageProofs.endAt,
        id: telegramHistoryCoverageProofs.id,
        provedAt: telegramHistoryCoverageProofs.provedAt,
        startAt: telegramHistoryCoverageProofs.startAt,
        telegramChatId: telegramHistoryCoverageProofs.telegramChatId
      })
      .from(telegramHistoryCoverageProofs)
      .where(
        and(
          eq(telegramHistoryCoverageProofs.telegramChatId, chatId),
          lte(telegramHistoryCoverageProofs.startAt, searchEndAt),
          gte(telegramHistoryCoverageProofs.endAt, searchStartAt)
        )
      );

    const repainted = repaintTelegramHistoryCoverageProofs(
      existingRows.map((row) => ({
        chatId: row.telegramChatId,
        endAt: row.endAt,
        provedAt: row.provedAt,
        startAt: row.startAt
      })),
      chatSegments
    );

    await deleteCoverageProofRows(
      database,
      existingRows.map((row) => row.id)
    );
    await insertCoverageProofSegments(database, repainted);
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

async function deleteCoverageProofRows(database: AppDatabase, ids: number[]): Promise<void> {
  for (const chunk of chunks(ids, TELEGRAM_HISTORY_COVERAGE_BATCH_CHUNK_SIZE)) {
    if (chunk.length > 0) {
      await database
        .delete(telegramHistoryCoverageProofs)
        .where(inArray(telegramHistoryCoverageProofs.id, chunk));
    }
  }
}

async function insertCoverageProofSegments(
  database: AppDatabase,
  segments: TelegramHistoryCoverageProofSegment[]
): Promise<void> {
  for (const values of chunks(segments, TELEGRAM_HISTORY_COVERAGE_BATCH_CHUNK_SIZE)) {
    if (values.length > 0) {
      await database.insert(telegramHistoryCoverageProofs).values(
        values.map((segment) => ({
          endAt: segment.endAt,
          provedAt: segment.provedAt,
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

function mergeProofSegmentsForChat(
  chatId: string,
  segments: TelegramHistoryCoverageProofSegment[]
): TelegramHistoryCoverageProofSegment[] {
  const sorted = segments
    .map((segment) => normalizeTelegramHistoryInterval(segment))
    .filter((segment) => segment.startAt < segment.endAt)
    .sort(compareIntervalStart);
  const merged: TelegramHistoryCoverageProofSegment[] = [];

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

function intervalsOverlap(
  first: TelegramHistoryInterval,
  second: TelegramHistoryInterval
): boolean {
  return first.startAt < second.endAt && first.endAt > second.startAt;
}

function compareIntervalStart(
  first: TelegramHistoryInterval,
  second: TelegramHistoryInterval
): number {
  const startDifference = first.startAt.getTime() - second.startAt.getTime();
  return startDifference === 0 ? first.endAt.getTime() - second.endAt.getTime() : startDifference;
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
