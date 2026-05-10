import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import type { JsonObject } from '@agentg/events/json';

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
