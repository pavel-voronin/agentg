import { randomUUID } from 'node:crypto';

import type { Database } from 'better-sqlite3';

import type { JsonObject } from '../../bus/events.js';
import type { HistoryMessage } from '../../history/historyRepository.js';
import type {
  SummaryInvalidation,
  SummaryReadResult,
  SummaryRequest,
  SummaryRequestResult,
  SummaryResult,
  SummaryRun,
  SummarySourceReference
} from './types.js';

export type SummariesRepository = {
  clearInvalidation(chatId: string): void;
  readChatSummary(chatId: string): SummaryReadResult;
  recordInvalidation(input: {
    chatId: string;
    eventId?: string;
    invalidatedAt: Date;
    reason: string;
  }): SummaryInvalidation;
  requestSummary(
    input: SummaryRequest,
    sourceMessages: HistoryMessage[],
    now: Date
  ): SummaryRequestResult;
};

type RunRow = {
  completed_at: string | null;
  error_json: string | null;
  failed_at: string | null;
  id: string;
  reason: string | null;
  requested_at: string;
  started_at: string | null;
  status: SummaryRun['status'];
  telegram_chat_id: string;
  updated_at: string;
};

type ResultRow = {
  created_at: string;
  id: number;
  run_id: string;
  summary: string;
  telegram_chat_id: string;
  updated_at: string;
};

type InvalidationRow = {
  event_id: string | null;
  invalidated_at: string;
  reason: string;
  telegram_chat_id: string;
  updated_at: string;
};

type SourceReferenceRow = {
  message_date: string | null;
  telegram_message_id: string;
};

export function createSummariesRepository(database: Database): SummariesRepository {
  const repository: SummariesRepository = {
    clearInvalidation(chatId): void {
      database
        .prepare('DELETE FROM summaries_invalidations WHERE telegram_chat_id = ?')
        .run(chatId);
    },
    readChatSummary(chatId): SummaryReadResult {
      return {
        invalidation: readInvalidation(database, chatId),
        summary: readLatestSummary(database, chatId)
      };
    },
    recordInvalidation(input): SummaryInvalidation {
      const row = database
        .prepare(
          `
            INSERT INTO summaries_invalidations (
              telegram_chat_id,
              event_id,
              invalidated_at,
              reason
            )
            VALUES (?, ?, ?, ?)
            ON CONFLICT (telegram_chat_id) DO UPDATE SET
              event_id = excluded.event_id,
              invalidated_at = excluded.invalidated_at,
              reason = excluded.reason,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            RETURNING telegram_chat_id, event_id, invalidated_at, reason, updated_at
          `
        )
        .get(
          input.chatId,
          input.eventId ?? null,
          input.invalidatedAt.toISOString(),
          input.reason
        ) as InvalidationRow;

      return mapInvalidationRow(row);
    },
    requestSummary(input, sourceMessages, now): SummaryRequestResult {
      const timestamp = now.toISOString();
      const runId = `sumrun_${randomUUID()}`;
      const sourceReferences = sourceMessages.map((message) => ({
        messageDate: message.messageDate ?? null,
        messageId: message.messageId
      }));
      const summaryText = createSummaryText(input, sourceReferences, now);

      const transaction = database.transaction(() => {
        const run = database
          .prepare(
            `
              INSERT INTO summaries_runs (
                id,
                telegram_chat_id,
                status,
                reason,
                requested_at,
                started_at,
                completed_at
              )
              VALUES (?, ?, 'completed', ?, ?, ?, ?)
              RETURNING
                id,
                telegram_chat_id,
                status,
                reason,
                requested_at,
                started_at,
                completed_at,
                failed_at,
                error_json,
                updated_at
            `
          )
          .get(
            runId,
            input.chatId,
            input.reason ?? null,
            timestamp,
            timestamp,
            timestamp
          ) as RunRow;

        const result = database
          .prepare(
            `
              INSERT INTO summaries_results (telegram_chat_id, run_id, summary)
              VALUES (?, ?, ?)
              ON CONFLICT (telegram_chat_id) DO UPDATE SET
                run_id = excluded.run_id,
                summary = excluded.summary,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              RETURNING id, telegram_chat_id, run_id, summary, created_at, updated_at
            `
          )
          .get(input.chatId, runId, summaryText) as ResultRow;

        replaceSourceReferences(database, result.id, input.chatId, sourceReferences);
        repository.clearInvalidation(input.chatId);

        return {
          run: mapRunRow(run),
          summary: mapResultRow(result, readSourceReferences(database, result.id))
        };
      });

      return transaction();
    }
  };

  return repository;
}

function readLatestSummary(database: Database, chatId: string): SummaryResult | null {
  const row = database
    .prepare(
      `
        SELECT id, telegram_chat_id, run_id, summary, created_at, updated_at
        FROM summaries_results
        WHERE telegram_chat_id = ?
      `
    )
    .get(chatId) as ResultRow | undefined;

  return row === undefined ? null : mapResultRow(row, readSourceReferences(database, row.id));
}

function readInvalidation(database: Database, chatId: string): SummaryInvalidation | null {
  const row = database
    .prepare(
      `
        SELECT telegram_chat_id, event_id, invalidated_at, reason, updated_at
        FROM summaries_invalidations
        WHERE telegram_chat_id = ?
      `
    )
    .get(chatId) as InvalidationRow | undefined;

  return row === undefined ? null : mapInvalidationRow(row);
}

function replaceSourceReferences(
  database: Database,
  resultId: number,
  chatId: string,
  references: SummarySourceReference[]
): void {
  database.prepare('DELETE FROM summaries_source_refs WHERE result_id = ?').run(resultId);

  const statement = database.prepare(
    `
      INSERT INTO summaries_source_refs (
        result_id,
        telegram_chat_id,
        telegram_message_id,
        message_date
      )
      VALUES (?, ?, ?, ?)
    `
  );

  for (const reference of references) {
    statement.run(resultId, chatId, reference.messageId, reference.messageDate);
  }
}

function readSourceReferences(database: Database, resultId: number): SummarySourceReference[] {
  return database
    .prepare(
      `
        SELECT telegram_message_id, message_date
        FROM summaries_source_refs
        WHERE result_id = ?
        ORDER BY id ASC
      `
    )
    .all(resultId)
    .map((row) => mapSourceReferenceRow(row as SourceReferenceRow));
}

function createSummaryText(
  input: SummaryRequest,
  sourceReferences: SummarySourceReference[],
  now: Date
): string {
  const reason = input.reason ?? 'manual';
  return `Summary for chat ${input.chatId}: ${String(sourceReferences.length)} source message(s), reason ${reason}, generated at ${now.toISOString()}.`;
}

function mapRunRow(row: RunRow): SummaryRun {
  return {
    chatId: row.telegram_chat_id,
    completedAt: row.completed_at,
    error: row.error_json === null ? null : (JSON.parse(row.error_json) as JsonObject),
    failedAt: row.failed_at,
    id: row.id,
    reason: row.reason,
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    status: row.status,
    updatedAt: row.updated_at
  };
}

function mapResultRow(row: ResultRow, sourceReferences: SummarySourceReference[]): SummaryResult {
  return {
    chatId: row.telegram_chat_id,
    createdAt: row.created_at,
    id: row.id,
    runId: row.run_id,
    sourceReferences,
    summary: row.summary,
    updatedAt: row.updated_at
  };
}

function mapInvalidationRow(row: InvalidationRow): SummaryInvalidation {
  return {
    chatId: row.telegram_chat_id,
    eventId: row.event_id,
    invalidatedAt: row.invalidated_at,
    reason: row.reason,
    updatedAt: row.updated_at
  };
}

function mapSourceReferenceRow(row: SourceReferenceRow): SummarySourceReference {
  return {
    messageDate: row.message_date,
    messageId: row.telegram_message_id
  };
}
