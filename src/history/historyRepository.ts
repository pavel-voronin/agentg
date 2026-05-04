import type { Database } from 'better-sqlite3';

import { addCoverageInterval, type HistoryCoverageInterval } from './coverage.js';
import type { HistoryJob } from './jobs.js';
import type { HistoryBackfillJobInput } from './reconciler.js';
import type { TelegramMessageDto } from '../telegram/telegramRepository.js';

export type HistoryRepository = {
  addCoverage(interval: HistoryCoverageInterval): HistoryCoverageInterval[];
  createJobs(jobs: HistoryBackfillJobInput[]): HistoryJob[];
  listCoverage(chatId: string): HistoryCoverageInterval[];
  listMessages(chatId: string): HistoryMessage[];
  recordTelegramMessage(message: TelegramMessageDto, observedAt: Date): HistoryMessage | undefined;
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
  end_at: string;
  id: number;
  start_at: string;
  status: HistoryJob['status'];
  telegram_chat_id: string;
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
    createJobs(jobs): HistoryJob[] {
      const statement = database.prepare(
        `
          INSERT INTO history_jobs (telegram_chat_id, start_at, end_at)
          VALUES (?, ?, ?)
          RETURNING id, telegram_chat_id, start_at, end_at, status, created_at
        `
      );

      const transaction = database.transaction(() =>
        jobs.map((job) =>
          mapJobRow(
            statement.get(job.chatId, job.startAt.toISOString(), job.endAt.toISOString()) as JobRow
          )
        )
      );

      return transaction();
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
    endAt: new Date(row.end_at),
    id: row.id,
    startAt: new Date(row.start_at),
    status: row.status
  };
}
