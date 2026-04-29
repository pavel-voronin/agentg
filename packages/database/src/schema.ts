import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

import type { JsonObject } from '@agentg/shared/json';

export const telegramEvents = pgTable(
  'telegram_events',
  {
    eventKey: text('event_key').notNull().unique(),
    eventType: text('event_type').notNull(),
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }),
    payload: jsonb('payload').$type<JsonObject>().notNull(),
    payloadHash: text('payload_hash').notNull(),
    tdlibUpdateType: text('tdlib_update_type').notNull(),
    telegramChatId: text('telegram_chat_id'),
    telegramMessageId: text('telegram_message_id')
  },
  (table) => [index('telegram_events_chat_time_idx').on(table.telegramChatId, table.occurredAt)]
);

export const telegramChats = pgTable('telegram_chats', {
  raw: jsonb('raw').$type<JsonObject>().notNull(),
  telegramChatId: text('telegram_chat_id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const telegramUsers = pgTable('telegram_users', {
  firstName: text('first_name').notNull(),
  isBot: boolean('is_bot').notNull().default(false),
  isSelf: boolean('is_self').notNull().default(false),
  lastName: text('last_name').notNull(),
  raw: jsonb('raw').$type<JsonObject>().notNull(),
  telegramUserId: text('telegram_user_id').primaryKey(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  username: text('username')
});

export const telegramChatFolders = pgTable(
  'telegram_chat_folders',
  {
    iconName: text('icon_name'),
    position: integer('position').notNull(),
    raw: jsonb('raw').$type<JsonObject>().notNull(),
    telegramChatFolderId: integer('telegram_chat_folder_id').primaryKey(),
    title: text('title').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('telegram_chat_folders_position_idx').on(table.position)]
);

export const telegramMessages = pgTable(
  'telegram_messages',
  {
    contentType: text('content_type').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    editDate: timestamp('edit_date', { withTimezone: true }),
    isDeleted: boolean('is_deleted').notNull().default(false),
    messageDate: timestamp('message_date', { withTimezone: true }),
    raw: jsonb('raw').$type<JsonObject>().notNull(),
    senderId: text('sender_id'),
    senderType: text('sender_type'),
    telegramChatId: text('telegram_chat_id').notNull(),
    telegramMessageId: text('telegram_message_id').notNull(),
    text: text('text'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({
      columns: [table.telegramChatId, table.telegramMessageId]
    }),
    index('telegram_messages_chat_date_idx').on(table.telegramChatId, table.messageDate)
  ]
);

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

export const backfillJobs = pgTable(
  'backfill_jobs',
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
    index('backfill_jobs_status_interval_idx').on(table.status, table.endAt),
    uniqueIndex('backfill_jobs_chat_interval_unique_idx').on(
      table.telegramChatId,
      table.startAt,
      table.endAt
    )
  ]
);
