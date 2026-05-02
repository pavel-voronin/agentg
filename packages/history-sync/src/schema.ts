import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

import type { JsonObject } from '@agentg/shared/json';

export const historyTemplates = pgTable('history_templates', {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  id: text('id').primaryKey(),
  match: jsonb('match').$type<JsonObject>().notNull(),
  range: jsonb('range').$type<JsonObject>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const historyTargets = pgTable(
  'history_targets',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    id: text('id').primaryKey(),
    range: jsonb('range').$type<JsonObject>().notNull(),
    telegramChatId: text('telegram_chat_id').notNull(),
    templateId: text('template_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('history_targets_chat_idx').on(table.telegramChatId),
    uniqueIndex('history_targets_chat_range_unique_idx').on(table.telegramChatId, table.range)
  ]
);

export const historyCoverage = pgTable(
  'history_coverage',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    telegramChatId: text('telegram_chat_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('history_coverage_chat_interval_idx').on(table.telegramChatId, table.startAt)]
);

export const historyBackfillJobs = pgTable(
  'history_backfill_jobs',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cursor: jsonb('cursor').$type<JsonObject>(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    status: text('status').notNull(),
    telegramChatId: text('telegram_chat_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('history_backfill_jobs_status_interval_idx').on(table.status, table.endAt),
    uniqueIndex('history_backfill_jobs_chat_interval_unique_idx').on(
      table.telegramChatId,
      table.startAt,
      table.endAt
    )
  ]
);
