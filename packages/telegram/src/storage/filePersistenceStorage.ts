import { and, eq, notInArray, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramFileAssets,
  telegramFileDownloadJobs,
  telegramFileSlots,
  telegramTdlibFiles
} from '../database/schema.js';
import type { FileSnapshot } from '../domain/models/fileSnapshot.js';
import type { FileOwnerKey, FileStatus } from '../domain/models/fileRef.js';
import { ACTIVE_NOTIFICATION_MODEL, storyRef } from '../model/refs.js';
import type { ExtractedFileSlot } from '../files/types.js';

export type FileSlotScope = {
  slotKeyPrefix: string;
};

export type FileAssetStatus = Extract<FileStatus, 'failed' | 'known' | 'ready'>;

export type FileAssetRow = {
  assetKey: string;
  downloadError: string | null;
  status: FileAssetStatus;
};

export async function deleteStaleActiveNotificationFileSlots(
  database: Database,
  owners: FileOwnerKey[]
): Promise<void> {
  const ownerIds = [
    ...new Set(
      owners
        .filter((owner) => owner.ownerModel === ACTIVE_NOTIFICATION_MODEL)
        .map((owner) => owner.ownerId)
    )
  ];

  if (ownerIds.length === 0) {
    await database
      .delete(telegramFileSlots)
      .where(eq(telegramFileSlots.ownerModel, ACTIVE_NOTIFICATION_MODEL));
    return;
  }

  await database
    .delete(telegramFileSlots)
    .where(
      and(
        eq(telegramFileSlots.ownerModel, ACTIVE_NOTIFICATION_MODEL),
        notInArray(telegramFileSlots.ownerId, ownerIds)
      )
    );
}

export async function deleteStoryFileSlots(
  database: Database,
  input: { posterChatId: string; storyId: number }
): Promise<void> {
  const owner = storyRef(input);
  await database
    .delete(telegramFileSlots)
    .where(
      and(eq(telegramFileSlots.ownerModel, owner._model), eq(telegramFileSlots.ownerId, owner.id))
    );
}

export async function readOwnerFileSlotKeys(
  database: Database,
  owner: FileOwnerKey,
  scope?: FileSlotScope
): Promise<Set<string>> {
  const rows = await database
    .select({
      slotKey: telegramFileSlots.slotKey
    })
    .from(telegramFileSlots)
    .where(ownerSlotCondition(owner, scope));
  return new Set(rows.map((row) => row.slotKey));
}

export async function deleteOwnerFileSlots(
  database: Database,
  owner: FileOwnerKey,
  scope?: FileSlotScope
): Promise<number> {
  const removed = await database
    .delete(telegramFileSlots)
    .where(ownerSlotCondition(owner, scope))
    .returning({
      slotKey: telegramFileSlots.slotKey
    });
  return removed.length;
}

export async function deleteOwnerFileSlotsExcept(
  database: Database,
  owner: FileOwnerKey,
  slotKeys: readonly string[],
  scope?: FileSlotScope
): Promise<number> {
  const removed = await database
    .delete(telegramFileSlots)
    .where(
      and(ownerSlotCondition(owner, scope), notInArray(telegramFileSlots.slotKey, [...slotKeys]))
    )
    .returning({
      slotKey: telegramFileSlots.slotKey
    });
  return removed.length;
}

export async function upsertExtractedFileSnapshot(
  database: Database,
  file: FileSnapshot
): Promise<void> {
  const row = fileSnapshotRow(file);
  await database
    .insert(telegramTdlibFiles)
    .values(row)
    .onConflictDoUpdate({
      set: {
        ...row,
        updatedAt: sql`now()`
      },
      setWhere: fileSnapshotChangedCondition(row),
      target: telegramTdlibFiles.tdlibFileId
    });
}

export async function upsertFileAsset(
  database: Database,
  slot: ExtractedFileSlot,
  assetKey: string
): Promise<FileAssetRow> {
  const byteSizeMissingCondition =
    slot.byteSize === null ? sql`false` : sql`${telegramFileAssets.byteSize} is null`;
  const [asset] = await database
    .insert(telegramFileAssets)
    .values({
      assetKey,
      byteSize: slot.byteSize,
      latestTdlibFileId: slot.tdlibFileId,
      status: 'known'
    })
    .onConflictDoUpdate({
      set: {
        byteSize: sql`coalesce(${telegramFileAssets.byteSize}, ${slot.byteSize})`,
        latestTdlibFileId: slot.tdlibFileId,
        updatedAt: sql`now()`
      },
      setWhere: sql`${byteSizeMissingCondition} or ${telegramFileAssets.latestTdlibFileId} is distinct from ${slot.tdlibFileId}`,
      target: telegramFileAssets.assetKey
    })
    .returning({
      assetKey: telegramFileAssets.assetKey,
      downloadError: telegramFileAssets.downloadError,
      status: telegramFileAssets.status
    });

  if (asset !== undefined) {
    return {
      assetKey: asset.assetKey,
      downloadError: asset.downloadError,
      status: assertAssetStatus(asset.status)
    };
  }

  const [existing] = await database
    .select({
      assetKey: telegramFileAssets.assetKey,
      downloadError: telegramFileAssets.downloadError,
      status: telegramFileAssets.status
    })
    .from(telegramFileAssets)
    .where(eq(telegramFileAssets.assetKey, assetKey))
    .limit(1);
  if (existing === undefined) {
    throw new Error(`Telegram file asset was not upserted: ${assetKey}`);
  }
  return {
    assetKey: existing.assetKey,
    downloadError: existing.downloadError,
    status: assertAssetStatus(existing.status)
  };
}

export async function upsertFileSlot(
  database: Database,
  slot: ExtractedFileSlot,
  assetKey: string
): Promise<boolean> {
  const upserted = await database
    .insert(telegramFileSlots)
    .values({
      assetKey,
      byteSize: slot.byteSize,
      durationSeconds: slot.durationSeconds,
      fileName: slot.fileName,
      height: slot.height,
      mediaKind: slot.mediaKind,
      mimeType: slot.mimeType,
      ownerId: slot.owner.id,
      ownerModel: slot.owner._model,
      renderKind: slot.renderKind,
      slotKey: slot.slotKey,
      tdlibFileId: slot.tdlibFileId,
      width: slot.width
    })
    .onConflictDoUpdate({
      set: {
        assetKey,
        byteSize: slot.byteSize,
        durationSeconds: slot.durationSeconds,
        fileName: slot.fileName,
        height: slot.height,
        mediaKind: slot.mediaKind,
        mimeType: slot.mimeType,
        renderKind: slot.renderKind,
        tdlibFileId: slot.tdlibFileId,
        updatedAt: sql`now()`,
        width: slot.width
      },
      setWhere: sql`${telegramFileSlots.assetKey} is distinct from ${assetKey} or ${telegramFileSlots.byteSize} is distinct from ${slot.byteSize} or ${telegramFileSlots.durationSeconds} is distinct from ${slot.durationSeconds} or ${telegramFileSlots.fileName} is distinct from ${slot.fileName} or ${telegramFileSlots.height} is distinct from ${slot.height} or ${telegramFileSlots.mediaKind} is distinct from ${slot.mediaKind} or ${telegramFileSlots.mimeType} is distinct from ${slot.mimeType} or ${telegramFileSlots.renderKind} is distinct from ${slot.renderKind} or ${telegramFileSlots.tdlibFileId} is distinct from ${slot.tdlibFileId} or ${telegramFileSlots.width} is distinct from ${slot.width}`,
      target: [telegramFileSlots.ownerModel, telegramFileSlots.ownerId, telegramFileSlots.slotKey]
    })
    .returning({
      slotKey: telegramFileSlots.slotKey
    });

  return upserted.length === 1;
}

export async function enqueueFileAssetDownload(
  database: Database,
  assetKey: string,
  priority: number
): Promise<boolean> {
  const changed = await database
    .insert(telegramFileDownloadJobs)
    .values({
      assetKey,
      priority,
      status: 'queued'
    })
    .onConflictDoUpdate({
      set: {
        claimedAt: sql`case when ${telegramFileDownloadJobs.status} = ${'downloading'} then ${telegramFileDownloadJobs.claimedAt} else null end`,
        lastError: null,
        priority: sql`greatest(${telegramFileDownloadJobs.priority}, ${priority})`,
        status: sql`case when ${telegramFileDownloadJobs.status} = ${'downloading'} then ${'downloading'} else ${'queued'} end`,
        updatedAt: sql`now()`
      },
      setWhere: sql`${telegramFileDownloadJobs.priority} < ${priority}`,
      target: telegramFileDownloadJobs.assetKey
    })
    .returning({
      assetKey: telegramFileDownloadJobs.assetKey
    });
  await resetFileAssetFailureForRetry(database, assetKey);
  return changed.length > 0;
}

export async function handleFileSnapshot(
  database: Database,
  input: {
    file: FileSnapshot;
    isCompleted: boolean;
  }
): Promise<string[]> {
  await upsertExtractedFileSnapshot(database, input.file);
  const assetKey = fileAssetKey(input.file);
  const snapshotSignal = input.isCompleted
    ? sql`true`
    : sql`${telegramFileAssets.downloadedByteSize} is distinct from ${input.file.local.downloaded_size}`;
  const updated = await database
    .update(telegramFileAssets)
    .set({
      downloadedByteSize: input.file.local.downloaded_size,
      updatedAt: sql`now()`
    })
    .where(
      and(
        eq(telegramFileAssets.assetKey, assetKey),
        eq(telegramFileAssets.latestTdlibFileId, input.file.id),
        sql`${telegramFileAssets.status} <> 'ready'`,
        snapshotSignal
      )
    )
    .returning({
      assetKey: telegramFileAssets.assetKey
    });

  return updated.map((asset) => asset.assetKey);
}

export function fileAssetKey(file: FileSnapshot): string {
  return file.remote.unique_id.length > 0
    ? `telegram:${file.remote.unique_id}`
    : `tdlib:${String(file.id)}`;
}

function ownerSlotCondition(owner: FileOwnerKey, scope?: FileSlotScope): SQL {
  const condition = and(
    eq(telegramFileSlots.ownerModel, owner.ownerModel),
    eq(telegramFileSlots.ownerId, owner.ownerId),
    scope === undefined
      ? undefined
      : sql`${telegramFileSlots.slotKey} like ${`${scope.slotKeyPrefix}%`}`
  );
  if (condition === undefined) {
    throw new Error('File owner slot condition is required');
  }
  return condition;
}

async function resetFileAssetFailureForRetry(database: Database, assetKey: string): Promise<void> {
  await database
    .update(telegramFileAssets)
    .set({
      downloadError: null,
      status: 'known',
      updatedAt: sql`now()`
    })
    .where(and(eq(telegramFileAssets.assetKey, assetKey), eq(telegramFileAssets.status, 'failed')));
}

function fileSnapshotRow(file: FileSnapshot): typeof telegramTdlibFiles.$inferInsert {
  return {
    expectedSize: nullablePositive(file.expectedSize),
    localCanBeDeleted: file.local.can_be_deleted,
    localCanBeDownloaded: file.local.can_be_downloaded,
    localDownloadOffset: file.local.download_offset,
    localDownloadedPrefixSize: file.local.downloaded_prefix_size,
    localDownloadedSize: file.local.downloaded_size,
    localIsDownloadingActive: file.local.is_downloading_active,
    localIsDownloadingCompleted: file.local.is_downloading_completed,
    localPath: file.local.path,
    remoteId: file.remote.id,
    remoteIsUploadingActive: file.remote.is_uploading_active,
    remoteIsUploadingCompleted: file.remote.is_uploading_completed,
    remoteUniqueId: file.remote.unique_id,
    remoteUploadedSize: file.remote.uploaded_size,
    size: nullablePositive(file.size),
    tdlibFileId: file.id
  };
}

function fileSnapshotChangedCondition(row: typeof telegramTdlibFiles.$inferInsert) {
  return sql`${telegramTdlibFiles.expectedSize} is distinct from ${row.expectedSize} or ${telegramTdlibFiles.localCanBeDeleted} is distinct from ${row.localCanBeDeleted} or ${telegramTdlibFiles.localCanBeDownloaded} is distinct from ${row.localCanBeDownloaded} or ${telegramTdlibFiles.localDownloadOffset} is distinct from ${row.localDownloadOffset} or ${telegramTdlibFiles.localDownloadedPrefixSize} is distinct from ${row.localDownloadedPrefixSize} or ${telegramTdlibFiles.localDownloadedSize} is distinct from ${row.localDownloadedSize} or ${telegramTdlibFiles.localIsDownloadingActive} is distinct from ${row.localIsDownloadingActive} or ${telegramTdlibFiles.localIsDownloadingCompleted} is distinct from ${row.localIsDownloadingCompleted} or ${telegramTdlibFiles.localPath} is distinct from ${row.localPath} or ${telegramTdlibFiles.remoteId} is distinct from ${row.remoteId} or ${telegramTdlibFiles.remoteIsUploadingActive} is distinct from ${row.remoteIsUploadingActive} or ${telegramTdlibFiles.remoteIsUploadingCompleted} is distinct from ${row.remoteIsUploadingCompleted} or ${telegramTdlibFiles.remoteUniqueId} is distinct from ${row.remoteUniqueId} or ${telegramTdlibFiles.remoteUploadedSize} is distinct from ${row.remoteUploadedSize} or ${telegramTdlibFiles.size} is distinct from ${row.size}`;
}

function nullablePositive(value: number): number | null {
  return value > 0 ? value : null;
}

function assertAssetStatus(value: string): FileAssetStatus {
  if (value === 'failed' || value === 'known' || value === 'ready') {
    return value;
  }
  throw new Error(`Unknown file asset status: ${value}`);
}
