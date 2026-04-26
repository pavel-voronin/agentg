import {
  bigserial,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp
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
  lastName: text('last_name').notNull(),
  raw: jsonb('raw').$type<JsonObject>().notNull(),
  telegramUserId: text('telegram_user_id').primaryKey(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  username: text('username')
});

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

export const telegramSyncState = pgTable('telegram_sync_state', {
  key: text('key').primaryKey(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  value: jsonb('value').$type<JsonObject>().notNull()
});
