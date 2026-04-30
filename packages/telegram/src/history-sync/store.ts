import type { AppDatabase } from '@agentg/database/client';
import {
  backfillJobs,
  historyCoverage,
  historyTargets,
  historyTemplates,
  telegramChats
} from '@agentg/database/schema';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import type { JsonObject } from '@agentg/shared/json';
import type { NormalizedTelegramUpdate } from '../normalize.js';
import { persistTelegramUpdate } from '../store.js';
import { liveMessageCoverageInterval, normalizeCoverageIntervals } from './coverage.js';
import { canonicalizeHistoryRange } from './ranges.js';
import { normalizeTelegramHistoryInterval, TELEGRAM_HISTORY_TICK_MS } from './time.js';
import type {
  BackfillJob,
  BackfillJobInput,
  HistoryCoverageInterval,
  HistoryRange,
  HistoryTarget,
  HistoryTemplate
} from './types.js';

const coverageLocks = new Map<string, Promise<void>>();
const HISTORY_COVERAGE_BATCH_CHUNK_SIZE = 5000;

export type BackfillJobCheckpoint = {
  complete?: boolean;
  coveredInterval?: HistoryCoverageInterval;
  cursor?: JsonObject;
  remainingEndAt?: Date;
  updates?: NormalizedTelegramUpdate[];
};

export type BackfillJobCheckpointResult = {
  storedMessages: number;
};

export async function listHistoryTemplates(database: AppDatabase): Promise<HistoryTemplate[]> {
  const rows = await database
    .select({
      id: historyTemplates.id,
      match: historyTemplates.match,
      range: historyTemplates.range
    })
    .from(historyTemplates)
    .orderBy(asc(historyTemplates.id));

  return rows.map((row) => ({
    id: row.id,
    match: row.match,
    range: canonicalizeHistoryRange(row.range as HistoryRange)
  }));
}

export async function upsertHistoryTemplate(
  database: AppDatabase,
  template: HistoryTemplate
): Promise<void> {
  const range = canonicalizeHistoryRange(template.range);
  await database
    .insert(historyTemplates)
    .values({
      id: template.id,
      match: template.match,
      range
    })
    .onConflictDoUpdate({
      set: {
        match: template.match,
        range,
        updatedAt: sql`now()`
      },
      target: historyTemplates.id
    });
}

export async function listHistoryTargets(database: AppDatabase): Promise<HistoryTarget[]> {
  const rows = await database
    .select({
      id: historyTargets.id,
      range: historyTargets.range,
      telegramChatId: historyTargets.telegramChatId,
      templateId: historyTargets.templateId
    })
    .from(historyTargets)
    .orderBy(asc(historyTargets.telegramChatId), asc(historyTargets.id));

  return rows.map((row) => ({
    chatId: row.telegramChatId,
    id: row.id,
    range: canonicalizeHistoryRange(row.range as HistoryRange),
    ...(row.templateId === null ? {} : { templateId: row.templateId })
  }));
}

export async function listKnownTelegramChatIds(database: AppDatabase): Promise<string[]> {
  const rows = await database
    .select({
      telegramChatId: telegramChats.telegramChatId
    })
    .from(telegramChats)
    .orderBy(asc(telegramChats.telegramChatId));

  return rows.map((row) => row.telegramChatId);
}

export async function upsertHistoryTarget(
  database: AppDatabase,
  target: HistoryTarget
): Promise<void> {
  const range = canonicalizeHistoryRange(target.range);
  await database
    .insert(historyTargets)
    .values({
      id: target.id,
      range,
      telegramChatId: target.chatId,
      templateId: target.templateId
    })
    .onConflictDoUpdate({
      set: {
        range,
        telegramChatId: target.chatId,
        templateId: target.templateId,
        updatedAt: sql`now()`
      },
      target: historyTargets.id
    });
}

export async function deleteHistoryTarget(
  database: AppDatabase,
  targetId: string
): Promise<HistoryTarget | undefined> {
  const [deleted] = await database
    .delete(historyTargets)
    .where(eq(historyTargets.id, targetId))
    .returning({
      id: historyTargets.id,
      range: historyTargets.range,
      telegramChatId: historyTargets.telegramChatId,
      templateId: historyTargets.templateId
    });

  if (deleted === undefined) {
    return undefined;
  }

  return {
    chatId: deleted.telegramChatId,
    id: deleted.id,
    range: canonicalizeHistoryRange(deleted.range as HistoryRange),
    ...(deleted.templateId === null ? {} : { templateId: deleted.templateId })
  };
}

export async function upsertHistoryTargets(
  database: AppDatabase,
  targets: HistoryTarget[]
): Promise<void> {
  for (const target of targets) {
    await upsertHistoryTarget(database, target);
  }
}

export async function listHistoryCoverage(
  database: AppDatabase,
  chatId: string
): Promise<HistoryCoverageInterval[]> {
  const rows = await database
    .select({
      endAt: historyCoverage.endAt,
      startAt: historyCoverage.startAt,
      telegramChatId: historyCoverage.telegramChatId
    })
    .from(historyCoverage)
    .where(eq(historyCoverage.telegramChatId, chatId))
    .orderBy(asc(historyCoverage.startAt));

  return normalizeCoverageIntervals(
    rows.map((row) => ({
      chatId: row.telegramChatId,
      endAt: row.endAt,
      startAt: row.startAt
    }))
  );
}

export async function addHistoryCoverage(
  database: AppDatabase,
  interval: HistoryCoverageInterval
): Promise<void> {
  const normalizedInterval = normalizeTelegramHistoryInterval(interval);
  if (normalizedInterval.startAt >= normalizedInterval.endAt) {
    return;
  }

  await withCoverageLock(normalizedInterval.chatId, async () => {
    await database.transaction(async (transaction) => {
      await mergeHistoryCoverageInTransaction(transaction, normalizedInterval);
    });
  });
}

export async function addHistoryCoverageBatch(
  database: AppDatabase,
  intervals: HistoryCoverageInterval[]
): Promise<void> {
  const normalizedIntervals = normalizeCoverageIntervals(
    intervals
      .map(normalizeTelegramHistoryInterval)
      .filter((interval) => interval.startAt < interval.endAt)
  );
  if (normalizedIntervals.length === 0) {
    return;
  }

  await withCoverageLocks(
    uniqueSortedStrings(normalizedIntervals.map((interval) => interval.chatId)),
    async () => {
      await database.transaction(async (transaction) => {
        await mergeHistoryCoverageBatchInTransaction(transaction, normalizedIntervals);
      });
    }
  );
}

async function mergeHistoryCoverageInTransaction(
  database: AppDatabase,
  interval: HistoryCoverageInterval
): Promise<void> {
  const searchStartAt = new Date(interval.startAt.getTime() - TELEGRAM_HISTORY_TICK_MS);
  const searchEndAt = new Date(interval.endAt.getTime() + TELEGRAM_HISTORY_TICK_MS);
  const overlappingRows = await database
    .select({
      endAt: historyCoverage.endAt,
      id: historyCoverage.id,
      startAt: historyCoverage.startAt
    })
    .from(historyCoverage)
    .where(
      and(
        eq(historyCoverage.telegramChatId, interval.chatId),
        lte(historyCoverage.startAt, searchEndAt),
        gte(historyCoverage.endAt, searchStartAt)
      )
    );

  const normalizedOverlappingRows = overlappingRows.map((row) =>
    normalizeTelegramHistoryInterval(row)
  );
  const mergedStartAt = minDate(
    interval.startAt,
    ...normalizedOverlappingRows.map((row) => row.startAt)
  );
  const mergedEndAt = maxDate(interval.endAt, ...normalizedOverlappingRows.map((row) => row.endAt));
  const overlappingIds = overlappingRows.map((row) => row.id);

  if (overlappingIds.length > 0) {
    await database.delete(historyCoverage).where(inArray(historyCoverage.id, overlappingIds));
  }

  await database.insert(historyCoverage).values({
    endAt: mergedEndAt,
    startAt: mergedStartAt,
    telegramChatId: interval.chatId
  });
}

async function mergeHistoryCoverageBatchInTransaction(
  database: AppDatabase,
  intervals: HistoryCoverageInterval[]
): Promise<void> {
  const chatIds = uniqueSortedStrings(intervals.map((interval) => interval.chatId));
  const searchStartAt = new Date(
    minDateFromList(intervals.map((interval) => interval.startAt)).getTime() -
      TELEGRAM_HISTORY_TICK_MS
  );
  const searchEndAt = new Date(
    maxDateFromList(intervals.map((interval) => interval.endAt)).getTime() +
      TELEGRAM_HISTORY_TICK_MS
  );
  const overlappingRows = await database
    .select({
      endAt: historyCoverage.endAt,
      id: historyCoverage.id,
      startAt: historyCoverage.startAt,
      telegramChatId: historyCoverage.telegramChatId
    })
    .from(historyCoverage)
    .where(
      and(
        inArray(historyCoverage.telegramChatId, chatIds),
        lte(historyCoverage.startAt, searchEndAt),
        gte(historyCoverage.endAt, searchStartAt)
      )
    );

  const overlappingRowsByChat = groupBy(overlappingRows, (row) => row.telegramChatId);
  const intervalsByChat = groupBy(intervals, (interval) => interval.chatId);
  const deleteIds = new Set<number>();
  const insertIntervals: HistoryCoverageInterval[] = [];
  const updateEndAtByTime = new Map<number, { endAt: Date; ids: number[] }>();

  for (const [chatId, chatIntervals] of intervalsByChat.entries()) {
    const chatOverlappingRows = (overlappingRowsByChat.get(chatId) ?? []).filter((row) =>
      chatIntervals.some((interval) => intervalsTouch(interval, row))
    );
    const mergedIntervals = normalizeCoverageIntervals([
      ...chatIntervals,
      ...chatOverlappingRows.map((row) => ({
        chatId,
        endAt: row.endAt,
        startAt: row.startAt
      }))
    ]);

    if (canExtendSingleCoverageRow(chatId, chatOverlappingRows, mergedIntervals)) {
      const row = chatOverlappingRows[0];
      const interval = mergedIntervals[0];
      if (row !== undefined && interval !== undefined && interval.endAt > row.endAt) {
        const key = interval.endAt.getTime();
        const group = updateEndAtByTime.get(key) ?? { endAt: interval.endAt, ids: [] };
        group.ids.push(row.id);
        updateEndAtByTime.set(key, group);
      }
      continue;
    }

    for (const row of chatOverlappingRows) {
      deleteIds.add(row.id);
    }

    insertIntervals.push(...mergedIntervals);
  }

  for (const group of updateEndAtByTime.values()) {
    for (const ids of chunks(group.ids, HISTORY_COVERAGE_BATCH_CHUNK_SIZE)) {
      if (ids.length > 0) {
        await database
          .update(historyCoverage)
          .set({
            endAt: group.endAt,
            updatedAt: sql`now()`
          })
          .where(inArray(historyCoverage.id, ids));
      }
    }
  }

  for (const ids of chunks([...deleteIds], HISTORY_COVERAGE_BATCH_CHUNK_SIZE)) {
    if (ids.length > 0) {
      await database.delete(historyCoverage).where(inArray(historyCoverage.id, ids));
    }
  }

  for (const values of chunks(insertIntervals, HISTORY_COVERAGE_BATCH_CHUNK_SIZE)) {
    if (values.length > 0) {
      await database.insert(historyCoverage).values(
        values.map((interval) => ({
          endAt: interval.endAt,
          startAt: interval.startAt,
          telegramChatId: interval.chatId
        }))
      );
    }
  }
}

function canExtendSingleCoverageRow(
  chatId: string,
  rows: { endAt: Date; id: number; startAt: Date; telegramChatId: string }[],
  intervals: HistoryCoverageInterval[]
): boolean {
  if (rows.length !== 1 || intervals.length !== 1) {
    return false;
  }
  const row = rows[0];
  const interval = intervals[0];
  if (row === undefined || interval === undefined) {
    return false;
  }
  const normalizedRow = normalizeTelegramHistoryInterval({
    chatId,
    endAt: row.endAt,
    startAt: row.startAt
  });
  return interval.startAt.getTime() === normalizedRow.startAt.getTime();
}

export async function extendHistoryCoverageFromMessage(
  database: AppDatabase,
  chatId: string,
  messageDate: Date,
  observedUntil = new Date()
): Promise<void> {
  await addHistoryCoverage(
    database,
    liveMessageCoverageInterval({
      chatId,
      messageDate,
      observedUntil
    })
  );
}

export async function createBackfillJobs(
  database: AppDatabase,
  jobs: BackfillJobInput[]
): Promise<number> {
  let created = 0;
  for (const job of jobs) {
    const normalizedJob = normalizeTelegramHistoryInterval(job);
    if (normalizedJob.startAt >= normalizedJob.endAt) {
      continue;
    }
    const inserted = await database
      .insert(backfillJobs)
      .values({
        endAt: normalizedJob.endAt,
        startAt: normalizedJob.startAt,
        status: 'pending',
        telegramChatId: normalizedJob.chatId
      })
      .onConflictDoNothing({
        target: [backfillJobs.telegramChatId, backfillJobs.startAt, backfillJobs.endAt]
      })
      .returning({ id: backfillJobs.id });

    created += inserted.length;
  }

  return created;
}

export async function claimNextBackfillJob(
  database: AppDatabase
): Promise<BackfillJob | undefined> {
  const rows = await database
    .select({
      cursor: backfillJobs.cursor,
      endAt: backfillJobs.endAt,
      id: backfillJobs.id,
      startAt: backfillJobs.startAt,
      status: backfillJobs.status,
      telegramChatId: backfillJobs.telegramChatId
    })
    .from(backfillJobs)
    .where(eq(backfillJobs.status, 'pending'))
    .orderBy(desc(backfillJobs.endAt), desc(backfillJobs.startAt))
    .limit(1);

  const row = rows[0];
  if (row === undefined) {
    return undefined;
  }

  await database
    .update(backfillJobs)
    .set({
      status: 'running',
      updatedAt: sql`now()`
    })
    .where(eq(backfillJobs.id, row.id));

  return {
    chatId: row.telegramChatId,
    ...(row.cursor === null ? {} : { cursor: row.cursor }),
    ...normalizeTelegramHistoryInterval({
      endAt: row.endAt,
      startAt: row.startAt
    }),
    id: String(row.id),
    status: 'running'
  };
}

export async function updateBackfillJobCursor(
  database: AppDatabase,
  jobId: string,
  cursor: JsonObject
): Promise<void> {
  await database
    .update(backfillJobs)
    .set({
      cursor,
      updatedAt: sql`now()`
    })
    .where(eq(backfillJobs.id, Number(jobId)));
}

export async function checkpointBackfillJob(
  database: AppDatabase,
  job: BackfillJob,
  checkpoint: BackfillJobCheckpoint
): Promise<BackfillJobCheckpointResult> {
  const normalizedCoverage =
    checkpoint.coveredInterval === undefined
      ? undefined
      : normalizeTelegramHistoryInterval(checkpoint.coveredInterval);
  const updates = checkpoint.updates ?? [];

  const operation = async (): Promise<BackfillJobCheckpointResult> =>
    database.transaction(async (transaction) => {
      let storedMessages = 0;

      for (const update of updates) {
        const result = await persistTelegramUpdate(transaction, update);
        if (result.message) {
          storedMessages += 1;
        }
      }

      if (
        normalizedCoverage !== undefined &&
        normalizedCoverage.startAt < normalizedCoverage.endAt
      ) {
        await mergeHistoryCoverageInTransaction(transaction, normalizedCoverage);
      }

      if (checkpoint.complete === true) {
        await transaction.delete(backfillJobs).where(eq(backfillJobs.id, Number(job.id)));
      } else {
        await transaction
          .update(backfillJobs)
          .set({
            ...(checkpoint.cursor === undefined ? {} : { cursor: checkpoint.cursor }),
            ...(checkpoint.remainingEndAt === undefined
              ? {}
              : { endAt: normalizeRemainingEndAt(job, checkpoint.remainingEndAt) }),
            status: 'running',
            updatedAt: sql`now()`
          })
          .where(eq(backfillJobs.id, Number(job.id)));
      }

      return {
        storedMessages
      };
    });

  return normalizedCoverage === undefined
    ? operation()
    : withCoverageLock(normalizedCoverage.chatId, operation);
}

export async function completeBackfillJob(
  database: AppDatabase,
  job: BackfillJob,
  coveredInterval: HistoryCoverageInterval
): Promise<void> {
  await checkpointBackfillJob(database, job, {
    complete: true,
    coveredInterval
  });
}

export async function resetBackfillJob(database: AppDatabase, job: BackfillJob): Promise<void> {
  await database
    .update(backfillJobs)
    .set({
      status: 'pending',
      updatedAt: sql`now()`
    })
    .where(eq(backfillJobs.id, Number(job.id)));
}

export async function resetRunningBackfillJobs(database: AppDatabase): Promise<void> {
  await database
    .update(backfillJobs)
    .set({
      status: 'pending',
      updatedAt: sql`now()`
    })
    .where(eq(backfillJobs.status, 'running'));
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

function intervalsTouch(
  interval: HistoryCoverageInterval,
  row: { endAt: Date; startAt: Date }
): boolean {
  const searchStartAt = new Date(interval.startAt.getTime() - TELEGRAM_HISTORY_TICK_MS);
  const searchEndAt = new Date(interval.endAt.getTime() + TELEGRAM_HISTORY_TICK_MS);
  return row.startAt <= searchEndAt && row.endAt >= searchStartAt;
}

function minDate(first: Date, ...rest: Date[]): Date;
function minDate(...dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('minDate requires at least one date');
  }
  return rest.reduce((minimum, date) => (date < minimum ? date : minimum), first);
}

function minDateFromList(dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('minDateFromList requires at least one date');
  }
  return minDate(first, ...rest);
}

function maxDate(first: Date, ...rest: Date[]): Date;
function maxDate(...dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('maxDate requires at least one date');
  }
  return rest.reduce((maximum, date) => (date > maximum ? date : maximum), first);
}

function maxDateFromList(dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('maxDateFromList requires at least one date');
  }
  return maxDate(first, ...rest);
}

function normalizeRemainingEndAt(job: BackfillJob, remainingEndAt: Date): Date {
  return normalizeTelegramHistoryInterval({
    endAt: remainingEndAt,
    startAt: job.startAt
  }).endAt;
}

async function withCoverageLock<T>(chatId: string, operation: () => Promise<T>): Promise<T> {
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

async function withCoverageLocks<T>(
  chatIds: string[],
  operation: () => Promise<T>,
  index = 0
): Promise<T> {
  const chatId = chatIds[index];
  if (chatId === undefined) {
    return operation();
  }
  return withCoverageLock(chatId, () => withCoverageLocks(chatIds, operation, index + 1));
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}
