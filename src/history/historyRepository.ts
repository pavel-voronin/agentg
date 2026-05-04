import type { Database } from 'better-sqlite3';

import { addCoverageInterval, type HistoryCoverageInterval } from './coverage.js';
import type { BackfillPageCheckpoint, HistoryJob, HistoryJobCursor } from './jobs.js';
import type { HistoryBackfillJobInput } from './reconciler.js';
import type { TelegramMessageDto } from '../telegram/telegramRepository.js';

export type HistoryRepository = {
  addCoverage(interval: HistoryCoverageInterval): HistoryCoverageInterval[];
  checkpointJob(job: HistoryJob, checkpoint: HistoryJobCheckpoint): void;
  claimNextJob(): HistoryJob | undefined;
  completeJob(job: HistoryJob, coveredInterval: HistoryCoverageInterval): void;
  countCoverageIntervals(): number;
  countJobs(status?: HistoryJob['status']): number;
  countMessages(chatId: string): number;
  countTargets(): number;
  createJobs(jobs: HistoryBackfillJobInput[]): HistoryJob[];
  deleteTarget(targetId: string): HistoryTarget | undefined;
  listChatStats(chatIds: string[]): Map<string, HistoryChatStats>;
  listCoverage(chatId: string): HistoryCoverageInterval[];
  listJobs(chatId: string): HistoryJob[];
  listMessages(chatId: string): HistoryMessage[];
  listTargets(chatId?: string): HistoryTarget[];
  recordTelegramMessage(message: TelegramMessageDto, observedAt: Date): HistoryMessage | undefined;
  resetJob(job: HistoryJob): void;
  resetRunningJobs(): void;
  upsertTarget(target: HistoryTarget): HistoryTarget;
};

export type HistoryJobCheckpoint = Pick<
  BackfillPageCheckpoint,
  'complete' | 'remainingEndAt'
> & {
  coveredInterval?: HistoryCoverageInterval;
  cursor?: HistoryJobCursor;
};

export type HistoryMessage = {
  chatId: string;
  contentType: string;
  messageId: string;
  observedAt: string;
  updatedAt: string;
  messageDate?: string;
  text?: string;
};

export type HistoryBoundary =
  | {
      at: string;
      kind: 'absolute';
    }
  | {
      expression: string;
      kind: 'expression';
    };

export type HistoryRange = {
  end: HistoryBoundary;
  start: HistoryBoundary;
};

export type HistoryTarget = {
  chatId: string;
  id: string;
  range: HistoryRange;
  templateId?: string | null;
};

export type HistoryChatStats = {
  coverageIntervals: number;
  messageCount: number;
  pendingJobs: number;
  runningJobs: number;
  targets: number;
};

type CoverageRow = {
  end_at: string;
  source: 'backfill' | 'live';
  start_at: string;
  telegram_chat_id: string;
};

type MessageRow = {
  content_type: string;
  message_date: string | null;
  observed_at: string;
  telegram_chat_id: string;
  telegram_message_id: string;
  text: string | null;
  updated_at: string;
};

type JobRow = {
  created_at: string;
  cursor_json: string | null;
  end_at: string;
  id: number;
  start_at: string;
  status: HistoryJob['status'];
  telegram_chat_id: string;
  updated_at: string | null;
};

type TargetRow = {
  id: string;
  range_json: string;
  telegram_chat_id: string;
  template_id: string | null;
};

export function createHistoryRepository(database: Database): HistoryRepository {
  return {
    addCoverage(interval): HistoryCoverageInterval[] {
      const existing = this.listCoverage(interval.chatId);
      const normalized = addCoverageInterval(existing, interval);
      const transaction = database.transaction(() => {
        database
          .prepare('DELETE FROM history_coverage WHERE telegram_chat_id = ?')
          .run(interval.chatId);

        const statement = database.prepare(
          `
            INSERT INTO history_coverage (telegram_chat_id, start_at, end_at, source)
            VALUES (?, ?, ?, ?)
          `
        );

        for (const coverage of normalized) {
          statement.run(
            coverage.chatId,
            coverage.startAt.toISOString(),
            coverage.endAt.toISOString(),
            coverage.source
          );
        }
      });

      transaction();
      return this.listCoverage(interval.chatId);
    },
    checkpointJob(job, checkpoint): void {
      if (checkpoint.coveredInterval !== undefined) {
        this.addCoverage({
          ...checkpoint.coveredInterval,
          source: 'backfill'
        });
      }

      if (checkpoint.complete) {
        database
          .prepare(
            `
              UPDATE history_jobs
              SET status = 'completed',
                  cursor_json = NULL,
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              WHERE id = ?
            `
          )
          .run(job.id);
        return;
      }

      database
        .prepare(
          `
            UPDATE history_jobs
            SET end_at = ?,
                cursor_json = ?,
                status = 'running',
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
          `
        )
        .run(
          checkpoint.remainingEndAt.toISOString(),
          checkpoint.cursor === undefined ? null : JSON.stringify(checkpoint.cursor),
          job.id
        );
    },
    claimNextJob(): HistoryJob | undefined {
      const transaction = database.transaction(() => {
        const row = database
          .prepare(
            `
              SELECT
                id,
                telegram_chat_id,
                start_at,
                end_at,
                status,
                cursor_json,
                created_at,
                updated_at
              FROM history_jobs
              WHERE status = 'queued'
              ORDER BY end_at DESC, start_at DESC, id ASC
              LIMIT 1
            `
          )
          .get() as JobRow | undefined;

        if (row === undefined) {
          return undefined;
        }

        const updated = database
          .prepare(
            `
              UPDATE history_jobs
              SET status = 'running',
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              WHERE id = ?
              RETURNING
                id,
                telegram_chat_id,
                start_at,
                end_at,
                status,
                cursor_json,
                created_at,
                updated_at
            `
          )
          .get(row.id) as JobRow;

        return mapJobRow(updated);
      });

      return transaction();
    },
    completeJob(job, coveredInterval): void {
      this.checkpointJob(job, {
        complete: true,
        coveredInterval,
        remainingEndAt: job.endAt
      });
    },
    countCoverageIntervals(): number {
      const row = database.prepare('SELECT count(*) AS count FROM history_coverage').get() as {
        count: number;
      };
      return row.count;
    },
    countJobs(status): number {
      const row =
        status === undefined
          ? (database.prepare('SELECT count(*) AS count FROM history_jobs').get() as {
              count: number;
            })
          : (database
              .prepare(
                `
                  SELECT count(*) AS count
                  FROM history_jobs
                  WHERE status = ?
                `
              )
              .get(status) as { count: number });

      return row.count;
    },
    countMessages(chatId): number {
      const row = database
        .prepare(
          `
            SELECT count(*) AS count
            FROM history_messages
            WHERE telegram_chat_id = ?
          `
        )
        .get(chatId) as { count: number };

      return row.count;
    },
    countTargets(): number {
      const row = database.prepare('SELECT count(*) AS count FROM history_targets').get() as {
        count: number;
      };
      return row.count;
    },
    createJobs(jobs): HistoryJob[] {
      const statement = database.prepare(
        `
          INSERT INTO history_jobs (telegram_chat_id, start_at, end_at, updated_at)
          VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          RETURNING
            id,
            telegram_chat_id,
            start_at,
            end_at,
            status,
            cursor_json,
            created_at,
            updated_at
        `
      );
      const existing = database.prepare(
        `
          SELECT id
          FROM history_jobs
          WHERE telegram_chat_id = ?
            AND start_at = ?
            AND end_at = ?
          LIMIT 1
        `
      );

      const transaction = database.transaction(() => {
        const inserted: HistoryJob[] = [];
        for (const job of jobs) {
          const startAt = job.startAt.toISOString();
          const endAt = job.endAt.toISOString();
          const existingRow = existing.get(job.chatId, startAt, endAt) as
            | { id: number }
            | undefined;
          if (existingRow !== undefined) {
            continue;
          }

          inserted.push(mapJobRow(statement.get(job.chatId, startAt, endAt) as JobRow));
        }

        return inserted;
      });

      return transaction();
    },
    deleteTarget(targetId): HistoryTarget | undefined {
      const row = database
        .prepare(
          `
            DELETE FROM history_targets
            WHERE id = ?
            RETURNING id, telegram_chat_id, range_json, template_id
          `
        )
        .get(targetId) as TargetRow | undefined;

      return row === undefined ? undefined : mapTargetRow(row);
    },
    listChatStats(chatIds): Map<string, HistoryChatStats> {
      const stats = new Map<string, HistoryChatStats>();
      for (const chatId of chatIds) {
        stats.set(chatId, {
          coverageIntervals: 0,
          messageCount: 0,
          pendingJobs: 0,
          runningJobs: 0,
          targets: 0
        });
      }

      if (chatIds.length === 0) {
        return stats;
      }

      const placeholders = chatIds.map(() => '?').join(', ');
      const messageRows = database
        .prepare(
          `
            SELECT telegram_chat_id, count(*) AS count
            FROM history_messages
            WHERE telegram_chat_id IN (${placeholders})
            GROUP BY telegram_chat_id
          `
        )
        .all(...chatIds) as { count: number; telegram_chat_id: string }[];
      const coverageRows = database
        .prepare(
          `
            SELECT telegram_chat_id, count(*) AS count
            FROM history_coverage
            WHERE telegram_chat_id IN (${placeholders})
            GROUP BY telegram_chat_id
          `
        )
        .all(...chatIds) as { count: number; telegram_chat_id: string }[];
      const targetRows = database
        .prepare(
          `
            SELECT telegram_chat_id, count(*) AS count
            FROM history_targets
            WHERE telegram_chat_id IN (${placeholders})
            GROUP BY telegram_chat_id
          `
        )
        .all(...chatIds) as { count: number; telegram_chat_id: string }[];
      const jobRows = database
        .prepare(
          `
            SELECT telegram_chat_id, status, count(*) AS count
            FROM history_jobs
            WHERE telegram_chat_id IN (${placeholders})
            GROUP BY telegram_chat_id, status
          `
        )
        .all(...chatIds) as {
        count: number;
        status: HistoryJob['status'];
        telegram_chat_id: string;
      }[];

      for (const row of messageRows) {
        chatStatsFor(stats, row.telegram_chat_id).messageCount = row.count;
      }
      for (const row of coverageRows) {
        chatStatsFor(stats, row.telegram_chat_id).coverageIntervals = row.count;
      }
      for (const row of targetRows) {
        chatStatsFor(stats, row.telegram_chat_id).targets = row.count;
      }
      for (const row of jobRows) {
        const stat = chatStatsFor(stats, row.telegram_chat_id);
        if (row.status === 'queued') {
          stat.pendingJobs = row.count;
        } else if (row.status === 'running') {
          stat.runningJobs = row.count;
        }
      }

      return stats;
    },
    listCoverage(chatId): HistoryCoverageInterval[] {
      return database
        .prepare(
          `
            SELECT telegram_chat_id, start_at, end_at, source
            FROM history_coverage
            WHERE telegram_chat_id = ?
            ORDER BY start_at ASC
          `
        )
        .all(chatId)
        .map((row) => mapCoverageRow(row as CoverageRow));
    },
    listJobs(chatId): HistoryJob[] {
      return database
        .prepare(
          `
            SELECT
              id,
              telegram_chat_id,
              start_at,
              end_at,
              status,
              cursor_json,
              created_at,
              updated_at
            FROM history_jobs
            WHERE telegram_chat_id = ?
            ORDER BY created_at DESC, id DESC
          `
        )
        .all(chatId)
        .map((row) => mapJobRow(row as JobRow));
    },
    listMessages(chatId): HistoryMessage[] {
      return database
        .prepare(
          `
            SELECT
              telegram_chat_id,
              telegram_message_id,
              content_type,
              text,
              message_date,
              observed_at,
              updated_at
            FROM history_messages
            WHERE telegram_chat_id = ?
            ORDER BY message_date ASC, telegram_message_id ASC
          `
        )
        .all(chatId)
        .map((row) => mapMessageRow(row as MessageRow));
    },
    listTargets(chatId): HistoryTarget[] {
      const rows =
        chatId === undefined
          ? database
              .prepare(
                `
                  SELECT id, telegram_chat_id, range_json, template_id
                  FROM history_targets
                  ORDER BY telegram_chat_id ASC, id ASC
                `
              )
              .all()
          : database
              .prepare(
                `
                  SELECT id, telegram_chat_id, range_json, template_id
                  FROM history_targets
                  WHERE telegram_chat_id = ?
                  ORDER BY id ASC
                `
              )
              .all(chatId);

      return rows.map((row) => mapTargetRow(row as TargetRow));
    },
    recordTelegramMessage(message, observedAt): HistoryMessage | undefined {
      if (message.messageDate === undefined) {
        return undefined;
      }

      const row = database
        .prepare(
          `
            INSERT INTO history_messages (
              telegram_chat_id,
              telegram_message_id,
              content_type,
              text,
              message_date,
              observed_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (telegram_chat_id, telegram_message_id) DO UPDATE SET
              content_type = excluded.content_type,
              text = excluded.text,
              message_date = excluded.message_date,
              observed_at = excluded.observed_at,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            RETURNING
              telegram_chat_id,
              telegram_message_id,
              content_type,
              text,
              message_date,
              observed_at,
              updated_at
          `
        )
        .get(
          message.chatId,
          message.messageId,
          message.contentType,
          message.text ?? null,
          message.messageDate,
          observedAt.toISOString()
        ) as MessageRow;

      return mapMessageRow(row);
    },
    resetJob(job): void {
      database
        .prepare(
          `
            UPDATE history_jobs
            SET status = 'queued',
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
          `
        )
        .run(job.id);
    },
    resetRunningJobs(): void {
      database
        .prepare(
          `
            UPDATE history_jobs
            SET status = 'queued',
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE status = 'running'
          `
        )
        .run();
    },
    upsertTarget(target): HistoryTarget {
      const row = database
        .prepare(
          `
            INSERT INTO history_targets (id, telegram_chat_id, range_json, template_id)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
              telegram_chat_id = excluded.telegram_chat_id,
              range_json = excluded.range_json,
              template_id = excluded.template_id,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            RETURNING id, telegram_chat_id, range_json, template_id
          `
        )
        .get(
          target.id,
          target.chatId,
          JSON.stringify(target.range),
          target.templateId ?? null
        ) as TargetRow;

      return mapTargetRow(row);
    }
  };
}

function mapCoverageRow(row: CoverageRow): HistoryCoverageInterval {
  return {
    chatId: row.telegram_chat_id,
    endAt: new Date(row.end_at),
    source: row.source,
    startAt: new Date(row.start_at)
  };
}

function chatStatsFor(stats: Map<string, HistoryChatStats>, chatId: string): HistoryChatStats {
  const existing = stats.get(chatId);
  if (existing === undefined) {
    throw new Error(`History stats were not initialized for chat: ${chatId}`);
  }

  return existing;
}

function mapMessageRow(row: MessageRow): HistoryMessage {
  return {
    chatId: row.telegram_chat_id,
    contentType: row.content_type,
    messageId: row.telegram_message_id,
    observedAt: row.observed_at,
    updatedAt: row.updated_at,
    ...(row.message_date === null ? {} : { messageDate: row.message_date }),
    ...(row.text === null ? {} : { text: row.text })
  };
}

function mapJobRow(row: JobRow): HistoryJob {
  return {
    chatId: row.telegram_chat_id,
    createdAt: row.created_at,
    ...(row.cursor_json === null ? {} : { cursor: parseJobCursor(row.cursor_json) }),
    endAt: new Date(row.end_at),
    id: row.id,
    startAt: new Date(row.start_at),
    status: row.status,
    updatedAt: row.updated_at ?? row.created_at
  };
}

function mapTargetRow(row: TargetRow): HistoryTarget {
  return {
    chatId: row.telegram_chat_id,
    id: row.id,
    range: parseHistoryRange(row.range_json),
    templateId: row.template_id
  };
}

function parseHistoryRange(value: string): HistoryRange {
  const parsed = JSON.parse(value) as unknown;
  const range = readRecord(parsed);
  const start = parseHistoryBoundary(range?.start);
  const end = parseHistoryBoundary(range?.end);
  if (start === undefined || end === undefined) {
    throw new Error('Stored history target range is invalid');
  }

  return { end, start };
}

function parseHistoryBoundary(value: unknown): HistoryBoundary | undefined {
  const boundary = readRecord(value);
  if (boundary?.kind === 'absolute' && typeof boundary.at === 'string') {
    return {
      at: boundary.at,
      kind: 'absolute'
    };
  }
  if (boundary?.kind === 'expression' && typeof boundary.expression === 'string') {
    return {
      expression: boundary.expression,
      kind: 'expression'
    };
  }

  return undefined;
}

function parseJobCursor(value: string): HistoryJobCursor {
  const parsed = JSON.parse(value) as unknown;
  const cursor = readRecord(parsed);
  if (cursor === undefined) {
    throw new Error('Stored history job cursor is invalid');
  }

  return cursor;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
