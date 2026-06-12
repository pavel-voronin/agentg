import { and, asc, eq, gt, gte, inArray, isNull, lte, sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramHistoryCoverage,
  telegramHistoryLiveChats,
  telegramHistoryLiveWindows
} from '../database/schema.js';
import { subtractHistoryIntervals, withHistoryCoverageLocks } from '../history/coverage.js';
import {
  HISTORY_TICK_MS,
  normalizeHistoryInterval,
  type HistoryInterval
} from '../history/time.js';
import type { MessageOwner } from '../procedures/get-messages/contract.js';
import { normalizeMessageOwner } from './owner.js';

export type OwnerCoverageSegment = HistoryInterval & {
  coveredAt: Date;
  ownerKey: string;
  ownerKind: string;
};

type CoverageRow = OwnerCoverageSegment & {
  id: number;
  telegramChatId: string | null;
};

const BATCH_SIZE = 5000;

export async function listOwnerCoverage(
  database: Database,
  owner: MessageOwner
): Promise<OwnerCoverageSegment[]> {
  const normalized = normalizeMessageOwner(owner);
  const [durable, live] = await Promise.all([
    database
      .select({
        coveredAt: telegramHistoryCoverage.coveredAt,
        endAt: telegramHistoryCoverage.endAt,
        ownerKey: telegramHistoryCoverage.ownerKey,
        ownerKind: telegramHistoryCoverage.ownerKind,
        startAt: telegramHistoryCoverage.startAt
      })
      .from(telegramHistoryCoverage)
      .where(eq(telegramHistoryCoverage.ownerKey, normalized.key))
      .orderBy(asc(telegramHistoryCoverage.startAt)),
    normalized.chatId === undefined ? Promise.resolve([]) : listLiveCoverage(database, owner)
  ]);

  return normalizeOwnerCoverageSegments([
    ...durable.map((row) => ({
      coveredAt: row.coveredAt,
      endAt: row.endAt,
      ownerKey: row.ownerKey,
      ownerKind: row.ownerKind,
      startAt: row.startAt
    })),
    ...live
  ]);
}

export async function isOwnerCovered(
  database: Database,
  owner: MessageOwner,
  interval: HistoryInterval
): Promise<boolean> {
  return (await missingOwnerCoverageIntervals(database, owner, [interval])).length === 0;
}

export async function missingOwnerCoverageIntervals(
  database: Database,
  owner: MessageOwner,
  desiredIntervals: HistoryInterval[]
): Promise<HistoryInterval[]> {
  const coverage = await listOwnerCoverage(database, owner);
  return subtractHistoryIntervals(desiredIntervals, coverage);
}

export async function writeOwnerCoverage(
  database: Database,
  owner: MessageOwner,
  intervals: HistoryInterval[],
  provedAt = new Date()
): Promise<OwnerCoverageSegment[]> {
  const normalized = normalizeMessageOwner(owner);
  const segments = normalizeOwnerCoverageSegments(
    intervals.map((interval) => ({
      ...normalizeHistoryInterval(interval),
      coveredAt: provedAt,
      ownerKey: normalized.key,
      ownerKind: normalized.kind
    }))
  );
  if (segments.length === 0) {
    return [];
  }

  await withHistoryCoverageLocks([normalized.key], async () =>
    database.transaction(async (transaction) => {
      await mergeCoverage(transaction, owner, segments);
    })
  );

  return segments;
}

export function normalizeOwnerCoverageSegments(
  segments: OwnerCoverageSegment[]
): OwnerCoverageSegment[] {
  const byOwner = groupBy(segments, (segment) => segment.ownerKey);
  return [...byOwner.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([, ownerSegments]) => mergeOwnerSegments(ownerSegments));
}

async function listLiveCoverage(
  database: Database,
  owner: MessageOwner
): Promise<OwnerCoverageSegment[]> {
  const normalized = normalizeMessageOwner(owner);
  if (normalized.chatId === undefined) {
    return [];
  }

  const [liveChat] = await database
    .select({
      eligibleFrom: telegramHistoryLiveChats.eligibleFrom
    })
    .from(telegramHistoryLiveChats)
    .where(eq(telegramHistoryLiveChats.telegramChatId, normalized.chatId))
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
    .where(
      and(
        isNull(telegramHistoryLiveWindows.closedAt),
        gt(telegramHistoryLiveWindows.endAt, liveChat.eligibleFrom)
      )
    )
    .orderBy(asc(telegramHistoryLiveWindows.startAt));

  return rows
    .map((row) => ({
      coveredAt: row.endAt,
      endAt: row.endAt,
      ownerKey: normalized.key,
      ownerKind: normalized.kind,
      startAt: row.startAt > liveChat.eligibleFrom ? row.startAt : liveChat.eligibleFrom
    }))
    .filter((segment) => segment.startAt < segment.endAt);
}

async function mergeCoverage(
  database: Database,
  owner: MessageOwner,
  segments: OwnerCoverageSegment[]
): Promise<void> {
  const normalized = normalizeMessageOwner(owner);
  const searchStartAt = new Date(
    minDateFromList(segments.map((segment) => segment.startAt)).getTime() - HISTORY_TICK_MS
  );
  const searchEndAt = new Date(
    maxDateFromList(segments.map((segment) => segment.endAt)).getTime() + HISTORY_TICK_MS
  );
  const rows = await database
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
        eq(telegramHistoryCoverage.ownerKey, normalized.key),
        lte(telegramHistoryCoverage.startAt, searchEndAt),
        gte(telegramHistoryCoverage.endAt, searchStartAt)
      )
    );
  const existingRows = rows.map((row) => ({
    coveredAt: row.coveredAt,
    endAt: row.endAt,
    id: row.id,
    ownerKey: row.ownerKey,
    ownerKind: row.ownerKind,
    startAt: row.startAt,
    telegramChatId: row.telegramChatId
  }));
  const merged = normalizeOwnerCoverageSegments([
    ...existingRows.map((row) => ({
      coveredAt: row.coveredAt,
      endAt: row.endAt,
      ownerKey: row.ownerKey,
      ownerKind: row.ownerKind,
      startAt: row.startAt
    })),
    ...segments
  ]);

  await applyMergePlan(database, owner, planMerge(existingRows, merged));
}

function planMerge(existingRows: CoverageRow[], mergedSegments: OwnerCoverageSegment[]) {
  const reusableRows = [...existingRows].sort(compareCoverageRowStart);
  const updates: { id: number; segment: OwnerCoverageSegment }[] = [];
  const updateCount = Math.min(reusableRows.length, mergedSegments.length);

  for (let index = 0; index < updateCount; index += 1) {
    const row = reusableRows[index];
    const segment = mergedSegments[index];
    if (row === undefined || segment === undefined || rowMatchesSegment(row, segment)) {
      continue;
    }
    updates.push({
      id: row.id,
      segment
    });
  }

  return {
    deleteIds: reusableRows.slice(mergedSegments.length).map((row) => row.id),
    inserts: mergedSegments.slice(reusableRows.length),
    updates
  };
}

async function applyMergePlan(
  database: Database,
  owner: MessageOwner,
  plan: ReturnType<typeof planMerge>
): Promise<void> {
  const normalized = normalizeMessageOwner(owner);
  for (const update of plan.updates) {
    await database
      .update(telegramHistoryCoverage)
      .set({
        coveredAt: update.segment.coveredAt,
        endAt: update.segment.endAt,
        ownerKey: update.segment.ownerKey,
        ownerKind: update.segment.ownerKind,
        startAt: update.segment.startAt,
        telegramChatId: normalized.chatId ?? null,
        updatedAt: sql`now()`
      })
      .where(eq(telegramHistoryCoverage.id, update.id));
  }

  for (const values of chunks(plan.inserts, BATCH_SIZE)) {
    if (values.length > 0) {
      await database.insert(telegramHistoryCoverage).values(
        values.map((segment) => ({
          coveredAt: segment.coveredAt,
          endAt: segment.endAt,
          ownerKey: segment.ownerKey,
          ownerKind: segment.ownerKind,
          startAt: segment.startAt,
          telegramChatId: normalized.chatId ?? null,
          updatedAt: sql`now()`
        }))
      );
    }
  }

  for (const ids of chunks(plan.deleteIds, BATCH_SIZE)) {
    if (ids.length > 0) {
      await database
        .delete(telegramHistoryCoverage)
        .where(inArray(telegramHistoryCoverage.id, ids));
    }
  }
}

function mergeOwnerSegments(segments: OwnerCoverageSegment[]): OwnerCoverageSegment[] {
  const sorted = segments
    .map((segment) => normalizeHistoryInterval(segment))
    .filter((segment) => segment.startAt < segment.endAt)
    .sort(compareIntervalStart);
  const merged: OwnerCoverageSegment[] = [];

  for (const segment of sorted) {
    const last = merged.at(-1);
    if (last === undefined) {
      merged.push({ ...segment });
      continue;
    }

    if (
      segment.ownerKey !== last.ownerKey ||
      segment.startAt.getTime() > last.endAt.getTime() + HISTORY_TICK_MS
    ) {
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

function rowMatchesSegment(row: CoverageRow, segment: OwnerCoverageSegment): boolean {
  return (
    row.ownerKey === segment.ownerKey &&
    row.ownerKind === segment.ownerKind &&
    row.startAt.getTime() === segment.startAt.getTime() &&
    row.endAt.getTime() === segment.endAt.getTime()
  );
}

function compareCoverageRowStart(first: CoverageRow, second: CoverageRow): number {
  const intervalDifference = compareIntervalStart(first, second);
  return intervalDifference === 0 ? first.id - second.id : intervalDifference;
}

function compareIntervalStart(first: HistoryInterval, second: HistoryInterval): number {
  const startDifference = first.startAt.getTime() - second.startAt.getTime();
  return startDifference === 0 ? first.endAt.getTime() - second.endAt.getTime() : startDifference;
}

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    grouped.set(key(value), [...(grouped.get(key(value)) ?? []), value]);
  }
  return grouped;
}

function minDateFromList(values: Date[]): Date {
  const first = values[0];
  if (first === undefined) {
    throw new Error('Expected at least one date');
  }
  return values.slice(1).reduce((minimum, value) => (value < minimum ? value : minimum), first);
}

function maxDateFromList(values: Date[]): Date {
  const first = values[0];
  if (first === undefined) {
    throw new Error('Expected at least one date');
  }
  return values.slice(1).reduce((maximum, value) => (value > maximum ? value : maximum), first);
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}
