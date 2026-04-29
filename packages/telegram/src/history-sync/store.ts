import type { AppDatabase } from '@agentg/database/client';
import {
  backfillJobs,
  historyCoverage,
  historyTargets,
  historyTemplates
} from '@agentg/database/schema';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import type { JsonObject } from '@agentg/shared/json';
import { liveMessageCoverageInterval, normalizeCoverageIntervals } from './coverage.js';
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
    range: row.range as HistoryRange
  }));
}

export async function upsertHistoryTemplate(
  database: AppDatabase,
  template: HistoryTemplate
): Promise<void> {
  await database
    .insert(historyTemplates)
    .values({
      id: template.id,
      match: template.match,
      range: template.range
    })
    .onConflictDoUpdate({
      set: {
        match: template.match,
        range: template.range,
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
    range: row.range as HistoryRange,
    ...(row.templateId === null ? {} : { templateId: row.templateId })
  }));
}

export async function upsertHistoryTarget(
  database: AppDatabase,
  target: HistoryTarget
): Promise<void> {
  await database
    .insert(historyTargets)
    .values({
      id: target.id,
      range: target.range,
      telegramChatId: target.chatId,
      templateId: target.templateId
    })
    .onConflictDoUpdate({
      set: {
        range: target.range,
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
    range: deleted.range as HistoryRange,
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
    await mergeHistoryCoverage(database, normalizedInterval);
  });
}

async function mergeHistoryCoverage(
  database: AppDatabase,
  interval: HistoryCoverageInterval
): Promise<void> {
  await database.transaction(async (transaction) => {
    const searchStartAt = new Date(interval.startAt.getTime() - TELEGRAM_HISTORY_TICK_MS);
    const searchEndAt = new Date(interval.endAt.getTime() + TELEGRAM_HISTORY_TICK_MS);
    const overlappingRows = await transaction
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
    const mergedEndAt = maxDate(
      interval.endAt,
      ...normalizedOverlappingRows.map((row) => row.endAt)
    );
    const overlappingIds = overlappingRows.map((row) => row.id);

    if (overlappingIds.length > 0) {
      await transaction.delete(historyCoverage).where(inArray(historyCoverage.id, overlappingIds));
    }

    await transaction.insert(historyCoverage).values({
      endAt: mergedEndAt,
      startAt: mergedStartAt,
      telegramChatId: interval.chatId
    });
  });
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
    const inserted = await database
      .insert(backfillJobs)
      .values({
        endAt: job.endAt,
        startAt: job.startAt,
        status: 'pending',
        telegramChatId: job.chatId
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
    endAt: row.endAt,
    id: String(row.id),
    startAt: row.startAt,
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

export async function completeBackfillJob(
  database: AppDatabase,
  job: BackfillJob,
  coveredInterval: HistoryCoverageInterval
): Promise<void> {
  await addHistoryCoverage(database, coveredInterval);
  await database.delete(backfillJobs).where(eq(backfillJobs.id, Number(job.id)));
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

function minDate(first: Date, ...rest: Date[]): Date {
  return rest.reduce((minimum, date) => (date < minimum ? date : minimum), first);
}

function maxDate(first: Date, ...rest: Date[]): Date {
  return rest.reduce((maximum, date) => (date > maximum ? date : maximum), first);
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
