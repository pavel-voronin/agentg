import { randomUUID } from 'node:crypto';

import { and, asc, eq, sql } from 'drizzle-orm';

import type { SummariesDatabase } from './database.js';
import {
  summariesInvalidations,
  summariesResults,
  summariesRuns,
  summariesSourceRefs
} from './schema.js';
import type {
  SummaryInvalidation,
  SummaryReadResult,
  SummaryRequest,
  SummaryRequestResult,
  SummaryResult,
  SummaryRun,
  SummaryRunReadResult,
  SummarySourceReference
} from './types.js';

export type SummaryRepository = {
  clearInvalidation(chatId: string): Promise<void>;
  readChatSummary(chatId: string): Promise<SummaryReadResult>;
  readRun(runId: string): Promise<SummaryRunReadResult>;
  recordInvalidation(input: {
    chatId: string;
    eventId?: string | undefined;
    invalidatedAt: Date;
    reason: string;
  }): Promise<SummaryInvalidation>;
  requestSummary(input: SummaryRequest, now: Date): Promise<SummaryRequestResult>;
};

export function createDrizzleSummaryRepository(database: SummariesDatabase): SummaryRepository {
  return {
    async clearInvalidation(chatId): Promise<void> {
      await database
        .delete(summariesInvalidations)
        .where(eq(summariesInvalidations.telegramChatId, chatId));
    },
    async readChatSummary(chatId): Promise<SummaryReadResult> {
      const summary = await readLatestSummary(database, chatId);
      const invalidation = await readInvalidation(database, chatId);

      return {
        invalidation,
        summary
      };
    },
    async readRun(runId): Promise<SummaryRunReadResult> {
      const [row] = await database
        .select()
        .from(summariesRuns)
        .where(eq(summariesRuns.id, runId))
        .limit(1);

      return {
        run: row === undefined ? null : runFromRow(row)
      };
    },
    async recordInvalidation(input): Promise<SummaryInvalidation> {
      const [row] = await database
        .insert(summariesInvalidations)
        .values({
          ...(input.eventId === undefined ? {} : { eventId: input.eventId }),
          invalidatedAt: input.invalidatedAt,
          reason: input.reason,
          telegramChatId: input.chatId
        })
        .onConflictDoUpdate({
          set: {
            eventId: input.eventId ?? null,
            invalidatedAt: input.invalidatedAt,
            reason: input.reason,
            updatedAt: sql`now()`
          },
          target: summariesInvalidations.telegramChatId
        })
        .returning();

      if (row === undefined) {
        throw new Error('Summary invalidation write returned no row');
      }

      return invalidationFromRow(row);
    },
    async requestSummary(input, now): Promise<SummaryRequestResult> {
      const runId = `sumrun_${randomUUID()}`;
      const summaryText = createSummaryText(input, now);
      const [runRow] = await database
        .insert(summariesRuns)
        .values({
          completedAt: now,
          id: runId,
          reason: input.reason,
          requestedAt: now,
          startedAt: now,
          status: 'completed',
          telegramChatId: input.chatId
        })
        .returning();

      if (runRow === undefined) {
        throw new Error('Summary run write returned no row');
      }

      const [resultRow] = await database
        .insert(summariesResults)
        .values({
          runId,
          summary: summaryText,
          telegramChatId: input.chatId
        })
        .onConflictDoUpdate({
          set: {
            runId,
            summary: summaryText,
            updatedAt: sql`now()`
          },
          target: summariesResults.telegramChatId
        })
        .returning();

      if (resultRow === undefined) {
        throw new Error('Summary result write returned no row');
      }

      await replaceSourceReferences(database, resultRow.id, input.chatId, input.sourceMessages);
      await this.clearInvalidation(input.chatId);

      const sourceReferences = await readSourceReferences(database, resultRow.id);

      return {
        run: runFromRow(runRow),
        summary: resultFromRow(resultRow, sourceReferences)
      };
    }
  };
}

export function createSummaryText(input: SummaryRequest, now: Date): string {
  const sourceCount = input.sourceMessages.length;
  const reason = input.reason ?? 'manual';
  return `Summary for chat ${input.chatId}: ${String(sourceCount)} source message(s), reason ${reason}, generated at ${now.toISOString()}.`;
}

async function readLatestSummary(
  database: SummariesDatabase,
  chatId: string
): Promise<SummaryResult | null> {
  const [row] = await database
    .select()
    .from(summariesResults)
    .where(eq(summariesResults.telegramChatId, chatId))
    .limit(1);

  if (row === undefined) {
    return null;
  }

  const sourceReferences = await readSourceReferences(database, row.id);
  return resultFromRow(row, sourceReferences);
}

async function readInvalidation(
  database: SummariesDatabase,
  chatId: string
): Promise<SummaryInvalidation | null> {
  const [row] = await database
    .select()
    .from(summariesInvalidations)
    .where(eq(summariesInvalidations.telegramChatId, chatId))
    .limit(1);

  return row === undefined ? null : invalidationFromRow(row);
}

async function replaceSourceReferences(
  database: SummariesDatabase,
  resultId: number,
  chatId: string,
  sourceReferences: SummarySourceReference[]
): Promise<void> {
  await database
    .delete(summariesSourceRefs)
    .where(
      and(
        eq(summariesSourceRefs.resultId, resultId),
        eq(summariesSourceRefs.telegramChatId, chatId)
      )
    );

  if (sourceReferences.length === 0) {
    return;
  }

  await database.insert(summariesSourceRefs).values(
    sourceReferences.map((reference) => ({
      messageDate: reference.messageDate === null ? null : new Date(reference.messageDate),
      resultId,
      telegramChatId: chatId,
      telegramMessageId: reference.messageId
    }))
  );
}

async function readSourceReferences(
  database: SummariesDatabase,
  resultId: number
): Promise<SummarySourceReference[]> {
  const rows = await database
    .select({
      messageDate: summariesSourceRefs.messageDate,
      telegramMessageId: summariesSourceRefs.telegramMessageId
    })
    .from(summariesSourceRefs)
    .where(eq(summariesSourceRefs.resultId, resultId))
    .orderBy(asc(summariesSourceRefs.id));

  return rows.map((row) => ({
    messageDate: row.messageDate?.toISOString() ?? null,
    messageId: row.telegramMessageId
  }));
}

type SummaryRunRow = typeof summariesRuns.$inferSelect;
type SummaryResultRow = typeof summariesResults.$inferSelect;
type SummaryInvalidationRow = typeof summariesInvalidations.$inferSelect;

function runFromRow(row: SummaryRunRow): SummaryRun {
  return {
    chatId: row.telegramChatId,
    completedAt: row.completedAt?.toISOString() ?? null,
    error: row.error ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    id: row.id,
    reason: row.reason,
    requestedAt: row.requestedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    status: parseRunStatus(row.status),
    updatedAt: row.updatedAt.toISOString()
  };
}

function resultFromRow(
  row: SummaryResultRow,
  sourceReferences: SummarySourceReference[]
): SummaryResult {
  return {
    chatId: row.telegramChatId,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    runId: row.runId,
    sourceReferences,
    summary: row.summary,
    updatedAt: row.updatedAt.toISOString()
  };
}

function invalidationFromRow(row: SummaryInvalidationRow): SummaryInvalidation {
  return {
    chatId: row.telegramChatId,
    eventId: row.eventId,
    invalidatedAt: row.invalidatedAt.toISOString(),
    reason: row.reason,
    updatedAt: row.updatedAt.toISOString()
  };
}

function parseRunStatus(value: string): SummaryRun['status'] {
  if (value === 'pending' || value === 'running' || value === 'completed' || value === 'failed') {
    return value;
  }

  return 'failed';
}
