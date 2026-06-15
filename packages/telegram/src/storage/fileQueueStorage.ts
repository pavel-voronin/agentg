import { and, eq, sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramFileAssets,
  telegramFileDownloadJobs,
  telegramFileSlots,
  telegramTdlibFiles
} from '../database/schema.js';
import { MESSAGE_MODEL, messageModelParts } from '../model/refs.js';
import type {
  FileDownloadRow,
  FileDownloadTransport,
  StoredCanonicalFile
} from '../files/runtime.js';

export type StaleFileDownloadRows = {
  hasMore: boolean;
  rows: FileDownloadRow[];
};

export async function claimNextQueuedFileDownload(
  database: Database
): Promise<FileDownloadRow | null> {
  const [candidate] = await database
    .select({
      assetKey: telegramFileDownloadJobs.assetKey
    })
    .from(telegramFileDownloadJobs)
    .where(eq(telegramFileDownloadJobs.status, 'queued'))
    .orderBy(sql`${telegramFileDownloadJobs.priority} desc`, telegramFileDownloadJobs.updatedAt)
    .limit(1);

  if (candidate === undefined) {
    return null;
  }

  const [claimed] = await database
    .update(telegramFileDownloadJobs)
    .set({
      attempts: sql`${telegramFileDownloadJobs.attempts} + 1`,
      claimedAt: sql`now()`,
      lastError: null,
      status: 'downloading',
      updatedAt: sql`now()`
    })
    .where(
      and(
        eq(telegramFileDownloadJobs.assetKey, candidate.assetKey),
        eq(telegramFileDownloadJobs.status, 'queued')
      )
    )
    .returning({
      assetKey: telegramFileDownloadJobs.assetKey
    });

  return claimed === undefined ? null : readFileDownloadRow(database, claimed.assetKey);
}

export async function readStaleFileDownloadRows(
  database: Database,
  staleBefore: Date,
  limit: number
): Promise<StaleFileDownloadRows> {
  const jobs = await database
    .select({
      assetKey: telegramFileDownloadJobs.assetKey
    })
    .from(telegramFileDownloadJobs)
    .where(staleDownloadCondition(staleBefore))
    .orderBy(
      sql`coalesce(${telegramFileDownloadJobs.claimedAt}, ${telegramFileDownloadJobs.updatedAt})`
    )
    .limit(limit + 1);

  const rows = await Promise.all(
    jobs.slice(0, limit).map((job) => readFileDownloadRow(database, job.assetKey))
  );
  return {
    hasMore: jobs.length > limit,
    rows: rows.filter((row): row is FileDownloadRow => row !== null)
  };
}

export async function readFileDownloadRow(
  database: Database,
  assetKey: string
): Promise<FileDownloadRow | null> {
  const [row] = await database
    .select({
      assetKey: telegramFileAssets.assetKey,
      attempts: telegramFileDownloadJobs.attempts,
      byteSize: telegramFileAssets.byteSize,
      downloadedByteSize: telegramFileAssets.downloadedByteSize,
      fileName: telegramFileSlots.fileName,
      latestTdlibFileId: telegramFileAssets.latestTdlibFileId,
      mediaKind: telegramFileSlots.mediaKind,
      mimeType: telegramFileSlots.mimeType,
      ownerId: telegramFileSlots.ownerId,
      ownerModel: telegramFileSlots.ownerModel,
      priority: telegramFileDownloadJobs.priority,
      remoteUniqueId: telegramTdlibFiles.remoteUniqueId,
      slotKey: telegramFileSlots.slotKey
    })
    .from(telegramFileDownloadJobs)
    .innerJoin(
      telegramFileAssets,
      eq(telegramFileAssets.assetKey, telegramFileDownloadJobs.assetKey)
    )
    .leftJoin(
      telegramTdlibFiles,
      eq(telegramTdlibFiles.tdlibFileId, telegramFileAssets.latestTdlibFileId)
    )
    .leftJoin(telegramFileSlots, eq(telegramFileSlots.assetKey, telegramFileDownloadJobs.assetKey))
    .where(eq(telegramFileAssets.assetKey, assetKey))
    .orderBy(
      sql`case when ${telegramFileSlots.ownerModel} = ${MESSAGE_MODEL} then 0 else 1 end`,
      telegramFileSlots.ownerModel,
      telegramFileSlots.ownerId,
      telegramFileSlots.slotKey
    )
    .limit(1);

  return row === undefined
    ? null
    : {
        assetKey: row.assetKey,
        attempts: row.attempts,
        byteSize: row.byteSize,
        downloadedByteSize: row.downloadedByteSize,
        fileName: row.fileName,
        latestTdlibFileId: row.latestTdlibFileId,
        mediaKind: row.mediaKind,
        mimeType: row.mimeType,
        ownerId: row.ownerId,
        ownerModel: row.ownerModel,
        priority: row.priority,
        remoteUniqueId: row.remoteUniqueId,
        slotKey: row.slotKey,
        transport: fileDownloadTransport(row.ownerModel, row.ownerId)
      };
}

export async function markFileDownloadReady(
  database: Database,
  assetKey: string,
  stored: StoredCanonicalFile
): Promise<void> {
  await database
    .update(telegramFileAssets)
    .set({
      byteSize: stored.byteSize,
      downloadedByteSize: stored.byteSize,
      downloadError: null,
      relativePath: stored.relativePath,
      sha256: stored.sha256,
      status: 'ready',
      updatedAt: sql`now()`
    })
    .where(eq(telegramFileAssets.assetKey, assetKey));

  await database
    .delete(telegramFileDownloadJobs)
    .where(eq(telegramFileDownloadJobs.assetKey, assetKey));
}

export function refreshFileDownloadClaim(database: Database, assetKey: string): Promise<void> {
  return markFileDownloadDownloading(database, assetKey, false);
}

export function markFileDownloadDispatched(database: Database, assetKey: string): Promise<void> {
  return markFileDownloadDownloading(database, assetKey, false);
}

export function markFileDownloadRedispatched(database: Database, assetKey: string): Promise<void> {
  return markFileDownloadDownloading(database, assetKey, true);
}

export async function markFileDownloadFailed(
  database: Database,
  assetKey: string,
  message: string
): Promise<void> {
  await database
    .update(telegramFileAssets)
    .set({
      downloadError: message,
      status: 'failed',
      updatedAt: sql`now()`
    })
    .where(
      and(eq(telegramFileAssets.assetKey, assetKey), sql`${telegramFileAssets.status} <> 'ready'`)
    );

  await database
    .delete(telegramFileDownloadJobs)
    .where(eq(telegramFileDownloadJobs.assetKey, assetKey));
}

export async function hasQueuedFileDownloads(database: Database): Promise<number> {
  const [row] = await database
    .select({ assetKey: telegramFileDownloadJobs.assetKey })
    .from(telegramFileDownloadJobs)
    .where(eq(telegramFileDownloadJobs.status, 'queued'))
    .limit(1);
  return row === undefined ? 0 : 1;
}

export async function hasDownloadingFileDownloads(database: Database): Promise<number> {
  const [row] = await database
    .select({ assetKey: telegramFileDownloadJobs.assetKey })
    .from(telegramFileDownloadJobs)
    .where(eq(telegramFileDownloadJobs.status, 'downloading'))
    .limit(1);
  return row === undefined ? 0 : 1;
}

async function markFileDownloadDownloading(
  database: Database,
  assetKey: string,
  incrementAttempts: boolean
): Promise<void> {
  await database
    .update(telegramFileDownloadJobs)
    .set({
      ...(incrementAttempts ? { attempts: sql`${telegramFileDownloadJobs.attempts} + 1` } : {}),
      claimedAt: sql`now()`,
      lastError: null,
      status: 'downloading',
      updatedAt: sql`now()`
    })
    .where(
      and(
        eq(telegramFileDownloadJobs.assetKey, assetKey),
        eq(telegramFileDownloadJobs.status, 'downloading')
      )
    );
}

function fileDownloadTransport(
  ownerModel: string | null,
  ownerId: string | null
): FileDownloadTransport {
  if (ownerModel !== MESSAGE_MODEL) {
    return { kind: 'file' };
  }
  if (ownerId === null) {
    throw new Error('Telegram message file download has no owner id');
  }
  const parts = messageModelParts(ownerId);
  if (parts === null) {
    throw new Error(`Telegram message file download has invalid owner id: ${ownerId}`);
  }
  return {
    chatId: parseTelegramInteger(parts.chatId, 'chat id'),
    kind: 'message',
    messageId: parseTelegramInteger(parts.messageId, 'message id')
  };
}

function staleDownloadCondition(staleBefore: Date) {
  return and(
    eq(telegramFileDownloadJobs.status, 'downloading'),
    sql`coalesce(${telegramFileDownloadJobs.claimedAt}, ${telegramFileDownloadJobs.updatedAt}) < ${staleBefore}`
  );
}

function parseTelegramInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Telegram ${label} must be a safe integer: ${value}`);
  }
  return parsed;
}
