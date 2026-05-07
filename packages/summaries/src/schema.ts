import { bigserial, bigint, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import type { JsonObject } from '@agentg/events/json';

export const summariesRuns = pgTable(
  'summaries_runs',
  {
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    error: jsonb('error').$type<JsonObject>(),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    id: text('id').primaryKey(),
    reason: text('reason'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    status: text('status').notNull(),
    telegramChatId: text('telegram_chat_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('summaries_runs_chat_status_idx').on(table.telegramChatId, table.status)]
);

export const summariesResults = pgTable(
  'summaries_results',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    runId: text('run_id').notNull(),
    summary: text('summary').notNull(),
    telegramChatId: text('telegram_chat_id').notNull().unique(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('summaries_results_chat_idx').on(table.telegramChatId)]
);

export const summariesSourceRefs = pgTable(
  'summaries_source_refs',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    messageDate: timestamp('message_date', { withTimezone: true }),
    resultId: bigint('result_id', { mode: 'number' }).notNull(),
    telegramChatId: text('telegram_chat_id').notNull(),
    telegramMessageId: text('telegram_message_id').notNull()
  },
  (table) => [
    index('summaries_source_refs_result_idx').on(table.resultId),
    index('summaries_source_refs_chat_message_idx').on(
      table.telegramChatId,
      table.telegramMessageId
    )
  ]
);

export const summariesInvalidations = pgTable(
  'summaries_invalidations',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    eventId: text('event_id'),
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }).notNull(),
    reason: text('reason').notNull(),
    telegramChatId: text('telegram_chat_id').primaryKey(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('summaries_invalidations_reason_idx').on(table.reason)]
);
