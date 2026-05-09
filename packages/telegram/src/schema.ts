import {
  bigserial,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp
} from 'drizzle-orm/pg-core';

import type { JsonObject } from '@agentg/events/json';

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

export const telegramFileAssets = pgTable(
  'telegram_file_assets',
  {
    assetKey: text('asset_key').primaryKey(),
    byteSize: integer('byte_size'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    downloadedByteSize: integer('downloaded_byte_size'),
    downloadError: text('download_error'),
    latestRemoteId: text('latest_remote_id'),
    latestTdlibFileId: integer('latest_tdlib_file_id'),
    provider: text('provider').notNull(),
    relativePath: text('relative_path'),
    remoteUniqueId: text('remote_unique_id'),
    sha256: text('sha256'),
    status: text('status').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('telegram_file_assets_status_idx').on(table.status, table.updatedAt),
    index('telegram_file_assets_tdlib_file_id_idx').on(table.latestTdlibFileId)
  ]
);

export const telegramFileDownloadJobs = pgTable(
  'telegram_file_download_jobs',
  {
    assetKey: text('asset_key').primaryKey(),
    attempts: integer('attempts').notNull().default(0),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    priority: integer('priority').notNull().default(0),
    status: text('status').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    foreignKey({
      columns: [table.assetKey],
      foreignColumns: [telegramFileAssets.assetKey],
      name: 'telegram_file_download_jobs_asset_key_fk'
    }).onDelete('cascade'),
    index('telegram_file_download_jobs_status_idx').on(table.status, table.updatedAt)
  ]
);

export const telegramFiles = pgTable(
  'telegram_files',
  {
    assetKey: text('asset_key').notNull(),
    byteSize: integer('byte_size'),
    durationSeconds: integer('duration_seconds'),
    fileName: text('file_name'),
    height: integer('height'),
    mediaKind: text('media_kind').notNull(),
    mimeType: text('mime_type'),
    ownerId: text('owner_id').notNull(),
    ownerModel: text('owner_model').notNull(),
    renderKind: text('render_kind').notNull(),
    slotKey: text('slot_key').notNull(),
    source: jsonb('source').$type<JsonObject>().notNull(),
    sourceFingerprint: text('source_fingerprint').notNull(),
    tdlibFileId: integer('tdlib_file_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    width: integer('width')
  },
  (table) => [
    primaryKey({
      columns: [table.ownerModel, table.ownerId, table.slotKey]
    }),
    foreignKey({
      columns: [table.assetKey],
      foreignColumns: [telegramFileAssets.assetKey],
      name: 'telegram_files_asset_key_fk'
    }).onDelete('cascade'),
    index('telegram_files_asset_idx').on(table.assetKey),
    index('telegram_files_owner_idx').on(table.ownerModel, table.ownerId),
    index('telegram_files_tdlib_file_id_idx').on(table.tdlibFileId)
  ]
);
