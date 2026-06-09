import { sql } from 'drizzle-orm';
import {
  bigserial,
  bigint as pgBigint,
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp
} from 'drizzle-orm/pg-core';

export * from './storageSchema.js';

export const telegramHistoryCoverage = pgTable(
  'telegram_history_coverage',
  {
    coveredAt: timestamp('covered_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    telegramChatId: text('telegram_chat_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('telegram_history_coverage_chat_interval_idx').on(table.telegramChatId, table.startAt)
  ]
);

export const telegramHistoryLiveWindows = pgTable(
  'telegram_history_live_windows',
  {
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closeReason: text('close_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('telegram_history_live_windows_closed_idx').on(table.closedAt),
    index('telegram_history_live_windows_interval_idx').on(table.startAt, table.endAt)
  ]
);

export const telegramHistoryLiveChats = pgTable(
  'telegram_history_live_chats',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    eligibleFrom: timestamp('eligible_from', { withTimezone: true }).notNull(),
    telegramChatId: text('telegram_chat_id').primaryKey(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('telegram_history_live_chats_eligible_idx').on(table.eligibleFrom)]
);

export const telegramFileAssets = pgTable(
  'telegram_file_assets',
  {
    assetKey: text('asset_key').primaryKey(),
    byteSize: pgBigint('byte_size', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    downloadedByteSize: pgBigint('downloaded_byte_size', { mode: 'number' }),
    downloadError: text('download_error'),
    latestTdlibFileId: integer('latest_tdlib_file_id'),
    relativePath: text('relative_path'),
    sha256: text('sha256'),
    status: text('status').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('telegram_file_assets_status_idx').on(table.status, table.updatedAt),
    index('telegram_file_assets_tdlib_file_id_idx').on(table.latestTdlibFileId)
  ]
);

export const telegramTdlibFiles = pgTable(
  'telegram_tdlib_files',
  {
    expectedSize: pgBigint('expected_size', { mode: 'number' }),
    localCanBeDeleted: boolean('local_can_be_deleted').notNull(),
    localCanBeDownloaded: boolean('local_can_be_downloaded').notNull(),
    localDownloadOffset: pgBigint('local_download_offset', { mode: 'number' }).notNull(),
    localDownloadedPrefixSize: pgBigint('local_downloaded_prefix_size', {
      mode: 'number'
    }).notNull(),
    localDownloadedSize: pgBigint('local_downloaded_size', { mode: 'number' }).notNull(),
    localIsDownloadingActive: boolean('local_is_downloading_active').notNull(),
    localIsDownloadingCompleted: boolean('local_is_downloading_completed').notNull(),
    localPath: text('local_path').notNull(),
    remoteId: text('remote_id').notNull(),
    remoteIsUploadingActive: boolean('remote_is_uploading_active').notNull(),
    remoteIsUploadingCompleted: boolean('remote_is_uploading_completed').notNull(),
    remoteUniqueId: text('remote_unique_id').notNull(),
    remoteUploadedSize: pgBigint('remote_uploaded_size', { mode: 'number' }).notNull(),
    size: pgBigint('size', { mode: 'number' }),
    tdlibFileId: integer('tdlib_file_id').primaryKey(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('telegram_tdlib_files_remote_unique_id_idx').on(table.remoteUniqueId),
    index('telegram_tdlib_files_local_completed_idx').on(table.localIsDownloadingCompleted)
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
    index('telegram_file_download_jobs_queued_idx')
      .on(sql`${table.priority} desc`, table.updatedAt)
      .where(sql`${table.status} = 'queued'`),
    index('telegram_file_download_jobs_downloading_stale_idx')
      .on(sql`coalesce(${table.claimedAt}, ${table.updatedAt})`)
      .where(sql`${table.status} = 'downloading'`)
  ]
);

export const telegramFileSlots = pgTable(
  'telegram_file_slots',
  {
    assetKey: text('asset_key').notNull(),
    byteSize: pgBigint('byte_size', { mode: 'number' }),
    durationSeconds: integer('duration_seconds'),
    fileName: text('file_name'),
    height: integer('height'),
    mediaKind: text('media_kind').notNull(),
    mimeType: text('mime_type'),
    ownerId: text('owner_id').notNull(),
    ownerModel: text('owner_model').notNull(),
    renderKind: text('render_kind').notNull(),
    slotKey: text('slot_key').notNull(),
    tdlibFileId: integer('tdlib_file_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    width: integer('width')
  },
  (table) => [
    primaryKey({
      columns: [table.ownerModel, table.ownerId, table.slotKey],
      name: 'telegram_file_slots_owner_model_owner_id_slot_key_pk'
    }),
    foreignKey({
      columns: [table.assetKey],
      foreignColumns: [telegramFileAssets.assetKey],
      name: 'telegram_file_slots_asset_key_fk'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.tdlibFileId],
      foreignColumns: [telegramTdlibFiles.tdlibFileId],
      name: 'telegram_file_slots_tdlib_file_id_fk'
    }).onDelete('cascade'),
    index('telegram_file_slots_asset_idx').on(table.assetKey),
    index('telegram_file_slots_owner_idx').on(table.ownerModel, table.ownerId),
    index('telegram_file_slots_tdlib_file_id_idx').on(table.tdlibFileId)
  ]
);
