import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { createLogger, logError } from '@agentg/framework';
import { and, eq, sql } from 'drizzle-orm';
import type { file } from 'tdlib-types';

import type { Database } from '../database/client.js';
import {
  telegramFileAssets,
  telegramFileDownloadJobs,
  telegramFileSlots
} from '../database/schema.js';
import { MESSAGE_MODEL, messageModelParts } from '../model/refs.js';
import { assertPriority, priorities } from '../tdlib/priority.js';
import { tdFileOrUndefined } from '../tdlib/value.js';
import { publishAssetOwnersAndQueue, publishFileQueueUpdated } from './events.js';
import type {
  CompletedFileAsset,
  FileDownloadBatchResult,
  FileDownloadResult,
  FileDownloadRow,
  FileDownloadTransport,
  FileSubsystemOptions,
  StoredCanonicalFile
} from './runtime.js';
import {
  CANONICAL_FILES_DIR,
  DEFAULT_WORKER_MAX_CONCURRENT_DOWNLOADS,
  DEFAULT_WORKER_MAX_FILES_PER_TICK,
  completedFileAssetFromTdlibFile,
  emptyBatchResult,
  positiveInteger,
  shouldDeferFileDownloads
} from './runtime.js';
import { recordWorkerBatchResult, recordWorkerJobs, timeWorkerStage } from './telemetry.js';

// TODO(file-size): Split worker loop, TDLib dispatch, canonical storage, and cleanup helpers.
const DOWNLOAD_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;
const logger = createLogger('telegram');

export async function processQueuedFileBatch(
  options: FileSubsystemOptions,
  limits: {
    maxConcurrentDownloads: number;
    maxFilesPerTick: number;
  }
): Promise<FileDownloadBatchResult> {
  const rows: FileDownloadRow[] = [];
  const maxFilesPerTick = positiveInteger(
    limits.maxFilesPerTick,
    DEFAULT_WORKER_MAX_FILES_PER_TICK
  );
  const maxConcurrentDownloads = positiveInteger(
    limits.maxConcurrentDownloads,
    DEFAULT_WORKER_MAX_CONCURRENT_DOWNLOADS
  );

  const reconciled = await timeWorkerStage('reconcile_stale', () =>
    reconcileStaleFileDownloads(options, maxFilesPerTick)
  );
  recordWorkerBatchResult('stale', reconciled);

  if (shouldDeferFileDownloads(options.tdlib)) {
    const delayedCount = await hasQueuedFileDownloads(options.database);
    if (delayedCount > 0) {
      return {
        ...reconciled,
        delayedCount: reconciled.delayedCount + delayedCount
      };
    }
  } else {
    await timeWorkerStage('claim_batch', async () => {
      for (let index = 0; index < maxFilesPerTick; index += 1) {
        const row = await claimNextQueuedFileDownload(options.database);
        if (row === null) {
          break;
        }
        rows.push(row);
      }
    });
    recordWorkerJobs('batch', 'claimed', rows.length);
  }

  if (rows.length === 0) {
    return {
      ...reconciled,
      watchdogCount:
        reconciled.watchdogCount + (await hasDownloadingFileDownloads(options.database))
    };
  }

  await timeWorkerStage('publish_changes', () => publishFileQueueUpdated(options));
  const results: FileDownloadResult[] = [];
  for (let index = 0; index < rows.length; index += maxConcurrentDownloads) {
    const batch = rows.slice(index, index + maxConcurrentDownloads);
    results.push(...(await Promise.all(batch.map((row) => processClaimedFile(options, row)))));
  }

  await timeWorkerStage('publish_changes', () =>
    publishAssetOwnersAndQueue(options, [...new Set(results.map((result) => result.assetKey))])
  );

  const batchResult = {
    delayedCount: 0,
    failedCount: results.filter((result) => result.failed).length,
    immediateCount: rows.length === maxFilesPerTick ? 1 : 0,
    processedCount: results.length,
    readyCount: results.filter((result) => result.ready).length,
    watchdogCount: results.filter((result) => !result.failed && !result.ready).length
  };
  recordWorkerBatchResult('batch', batchResult);
  return {
    delayedCount: reconciled.delayedCount + batchResult.delayedCount,
    failedCount: reconciled.failedCount + batchResult.failedCount,
    immediateCount: reconciled.immediateCount + batchResult.immediateCount,
    processedCount: reconciled.processedCount + batchResult.processedCount,
    readyCount: reconciled.readyCount + batchResult.readyCount,
    watchdogCount: reconciled.watchdogCount + batchResult.watchdogCount
  };
}

async function claimNextQueuedFileDownload(database: Database): Promise<FileDownloadRow | null> {
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

async function processClaimedFile(
  options: FileSubsystemOptions,
  row: FileDownloadRow
): Promise<FileDownloadResult> {
  try {
    const file = await timeWorkerStage('dispatch_tdlib', () =>
      dispatchTdlibFileDownload(options, row)
    );
    const completedFile = completedFileAssetFromTdlibFile(file);
    if (completedFile !== null) {
      await timeWorkerStage('canonicalize_completed', () =>
        canonicalizeCompletedFile(options, {
          ...completedFile,
          assetKey: row.assetKey
        })
      );
      return {
        assetKey: row.assetKey,
        failed: false,
        ready: true
      };
    }
    await markFileDownloadDispatched(options.database, row.assetKey);
    return {
      assetKey: row.assetKey,
      failed: false,
      ready: false
    };
  } catch (error) {
    await markFileDownloadFailed(options.database, row.assetKey, error);
    logFileDownloadFailed('batch', row, error);
    return {
      assetKey: row.assetKey,
      failed: true,
      ready: false
    };
  }
}

async function reconcileStaleFileDownloads(
  options: FileSubsystemOptions,
  limit: number
): Promise<FileDownloadBatchResult> {
  const staleBefore = new Date(Date.now() - DOWNLOAD_CLAIM_TIMEOUT_MS);
  const rows = await readStaleFileDownloadRows(options.database, staleBefore, limit);
  if (rows.length === 0) {
    return emptyBatchResult();
  }

  const results: FileDownloadResult[] = [];
  for (const row of rows) {
    results.push(await reconcileStaleFileDownload(options, row));
  }
  await timeWorkerStage('publish_changes', () =>
    publishAssetOwnersAndQueue(options, [...new Set(results.map((result) => result.assetKey))])
  );
  const failedCount = results.filter((result) => result.failed).length;
  const readyCount = results.filter((result) => result.ready).length;
  const downloadingCount = results.filter((result) => !result.failed && !result.ready).length;
  logger.info(
    {
      downloadingCount,
      event: 'telegram.file_worker_stale_reconciled',
      failedCount,
      readyCount,
      staleCount: results.length
    },
    'telegram file worker reconciled stale downloads'
  );
  return {
    delayedCount: 0,
    failedCount,
    immediateCount: 0,
    processedCount: results.length,
    readyCount,
    watchdogCount: downloadingCount
  };
}

async function readStaleFileDownloadRows(
  database: Database,
  staleBefore: Date,
  limit: number
): Promise<FileDownloadRow[]> {
  const jobs = await database
    .select({
      assetKey: telegramFileDownloadJobs.assetKey
    })
    .from(telegramFileDownloadJobs)
    .where(staleDownloadCondition(staleBefore))
    .orderBy(
      sql`coalesce(${telegramFileDownloadJobs.claimedAt}, ${telegramFileDownloadJobs.updatedAt})`
    )
    .limit(limit);

  const rows = await Promise.all(jobs.map((job) => readFileDownloadRow(database, job.assetKey)));
  return rows.filter((row): row is FileDownloadRow => row !== null);
}

async function reconcileStaleFileDownload(
  options: FileSubsystemOptions,
  row: FileDownloadRow
): Promise<FileDownloadResult> {
  try {
    const file = await timeWorkerStage('inspect_tdlib', () => getTdlibFile(options, row));
    const completedFile = completedFileAssetFromTdlibFile(file);
    if (completedFile !== null) {
      await timeWorkerStage('canonicalize_completed', () =>
        canonicalizeCompletedFile(options, {
          ...completedFile,
          assetKey: row.assetKey
        })
      );
      return {
        assetKey: row.assetKey,
        failed: false,
        ready: true
      };
    }
    await timeWorkerStage('dispatch_tdlib', () => dispatchTdlibFileDownload(options, row));
    await markFileDownloadDispatched(options.database, row.assetKey);
    return {
      assetKey: row.assetKey,
      failed: false,
      ready: false
    };
  } catch (error) {
    await markFileDownloadFailed(options.database, row.assetKey, error);
    logFileDownloadFailed('stale', row, error);
    return {
      assetKey: row.assetKey,
      failed: true,
      ready: false
    };
  }
}

type FileDownloadRequest =
  | {
      chatId: number;
      fileId: number;
      kind: 'message';
      messageId: number;
      priority: number;
    }
  | {
      fileId: number;
      kind: 'file';
      limit: 0;
      offset: 0;
      priority: number;
      synchronous: false;
    };

async function dispatchTdlibFileDownload(
  options: FileSubsystemOptions,
  row: FileDownloadRow
): Promise<file | undefined> {
  const request = fileDownloadRequest(row);
  if (request.kind === 'message') {
    return options.tdlib.addFileToDownloads(
      {
        chatId: request.chatId,
        fileId: request.fileId,
        messageId: request.messageId,
        priority: request.priority
      },
      { priority: row.priority }
    );
  }

  return options.tdlib.downloadFile(
    {
      fileId: request.fileId,
      limit: request.limit,
      offset: request.offset,
      priority: request.priority,
      synchronous: request.synchronous
    },
    { priority: row.priority }
  );
}

export function fileDownloadRequest(row: FileDownloadRow): FileDownloadRequest {
  if (row.latestTdlibFileId === null) {
    throw new Error(`Telegram file asset has no TDLib file id: ${row.assetKey}`);
  }
  const priority = assertPriority(row.priority);
  if (row.transport.kind === 'message') {
    return {
      chatId: row.transport.chatId,
      fileId: row.latestTdlibFileId,
      kind: 'message',
      messageId: row.transport.messageId,
      priority
    };
  }
  return {
    fileId: row.latestTdlibFileId,
    kind: 'file',
    limit: 0,
    offset: 0,
    priority,
    synchronous: false
  };
}

async function getTdlibFile(
  options: FileSubsystemOptions,
  row: FileDownloadRow
): Promise<file | undefined> {
  if (row.latestTdlibFileId === null) {
    throw new Error(`Telegram file asset has no TDLib file id: ${row.assetKey}`);
  }
  return tdFileOrUndefined(
    await options.tdlib.getFile(
      {
        fileId: row.latestTdlibFileId
      },
      {
        priority: priorities.low
      }
    )
  );
}

export async function processCompletedFileBatch(
  options: FileSubsystemOptions,
  completedFiles: Map<string, CompletedFileAsset>,
  limit: number
): Promise<FileDownloadBatchResult> {
  const files = [...completedFiles.values()].slice(0, limit);
  if (files.length === 0) {
    return emptyBatchResult();
  }
  for (const file of files) {
    completedFiles.delete(file.assetKey);
  }

  let failedCount = 0;
  let readyCount = 0;
  for (const file of files) {
    try {
      await timeWorkerStage('canonicalize_completed', () =>
        canonicalizeCompletedFile(options, file)
      );
      readyCount += 1;
    } catch (error) {
      logFileDownloadFailed('completed', file, error);
      failedCount += 1;
    }
  }

  return {
    delayedCount: 0,
    failedCount,
    immediateCount: completedFiles.size > 0 ? 1 : 0,
    processedCount: files.length,
    readyCount,
    watchdogCount: 0
  };
}

async function canonicalizeCompletedFile(
  options: FileSubsystemOptions,
  file: CompletedFileAsset
): Promise<void> {
  const row = await readFileDownloadRow(options.database, file.assetKey);
  if (row?.latestTdlibFileId !== file.tdlibFileId) {
    return;
  }

  try {
    const stored = await storeCanonicalFile(options.filesDirectory, file.localPath, row);
    await markFileDownloadReady(options.database, file.assetKey, stored);
    await cleanupTdlibFile(options, row);
  } catch (error) {
    await markFileDownloadFailed(options.database, file.assetKey, error);
    throw error;
  } finally {
    await publishAssetOwnersAndQueue(options, [file.assetKey]);
  }
}

async function readFileDownloadRow(
  database: Database,
  assetKey: string
): Promise<FileDownloadRow | null> {
  const [row] = await database
    .select({
      assetKey: telegramFileAssets.assetKey,
      byteSize: telegramFileAssets.byteSize,
      fileName: telegramFileSlots.fileName,
      latestTdlibFileId: telegramFileAssets.latestTdlibFileId,
      mimeType: telegramFileSlots.mimeType,
      ownerId: telegramFileSlots.ownerId,
      ownerModel: telegramFileSlots.ownerModel,
      priority: telegramFileDownloadJobs.priority
    })
    .from(telegramFileDownloadJobs)
    .innerJoin(
      telegramFileAssets,
      eq(telegramFileAssets.assetKey, telegramFileDownloadJobs.assetKey)
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
        byteSize: row.byteSize,
        fileName: row.fileName,
        latestTdlibFileId: row.latestTdlibFileId,
        mimeType: row.mimeType,
        priority: row.priority,
        transport: fileDownloadTransport(row.ownerModel, row.ownerId)
      };
}

async function markFileDownloadReady(
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

async function markFileDownloadDispatched(database: Database, assetKey: string): Promise<void> {
  await database
    .update(telegramFileDownloadJobs)
    .set({
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

async function markFileDownloadFailed(
  database: Database,
  assetKey: string,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
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

async function storeCanonicalFile(
  filesDirectory: string,
  localPath: string,
  row: FileDownloadRow
): Promise<StoredCanonicalFile> {
  const root = join(filesDirectory, CANONICAL_FILES_DIR);
  await mkdir(root, { recursive: true });
  const temporaryPath = join(root, `.tmp-${randomUUID()}`);
  const hash = createHash('sha256');
  const input = createReadStream(localPath);
  input.on('data', (chunk: Buffer | string) => {
    hash.update(chunk);
  });
  await pipeline(input, createWriteStream(temporaryPath));
  const sha256 = hash.digest('hex');
  const byteSize = (await stat(temporaryPath)).size;
  const relativePath = `${CANONICAL_FILES_DIR}/${sha256}${fileExtension(row, localPath)}`;
  const canonicalPath = join(filesDirectory, relativePath);

  try {
    await rename(temporaryPath, canonicalPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    if (!isExistingFileError(error)) {
      throw error;
    }
  }

  return {
    byteSize,
    relativePath,
    sha256
  };
}

async function cleanupTdlibFile(
  options: FileSubsystemOptions,
  row: FileDownloadRow
): Promise<void> {
  if (row.latestTdlibFileId === null) {
    return;
  }
  try {
    if (row.transport.kind === 'message') {
      await options.tdlib.removeFileFromDownloads(
        {
          deleteFromCache: true,
          fileId: row.latestTdlibFileId
        },
        {
          priority: priorities.low
        }
      );
      return;
    }

    await options.tdlib.deleteFile(
      {
        fileId: row.latestTdlibFileId
      },
      {
        priority: priorities.low
      }
    );
  } catch (error) {
    logTdlibCleanupError(row.assetKey, error);
  }
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
    chatId: parseTdlibInteger(parts.chatId, 'chat id'),
    kind: 'message',
    messageId: parseTdlibInteger(parts.messageId, 'message id')
  };
}

function staleDownloadCondition(staleBefore: Date) {
  return and(
    eq(telegramFileDownloadJobs.status, 'downloading'),
    sql`coalesce(${telegramFileDownloadJobs.claimedAt}, ${telegramFileDownloadJobs.updatedAt}) < ${staleBefore}`
  );
}

async function hasQueuedFileDownloads(database: Database): Promise<number> {
  const [row] = await database
    .select({ assetKey: telegramFileDownloadJobs.assetKey })
    .from(telegramFileDownloadJobs)
    .where(eq(telegramFileDownloadJobs.status, 'queued'))
    .limit(1);
  return row === undefined ? 0 : 1;
}

async function hasDownloadingFileDownloads(database: Database): Promise<number> {
  const [row] = await database
    .select({ assetKey: telegramFileDownloadJobs.assetKey })
    .from(telegramFileDownloadJobs)
    .where(eq(telegramFileDownloadJobs.status, 'downloading'))
    .limit(1);
  return row === undefined ? 0 : 1;
}

function fileExtension(row: FileDownloadRow, localPath: string): string {
  const fromFileName = row.fileName === null ? '' : extname(row.fileName);
  if (safeExtension(fromFileName)) {
    return fromFileName.toLowerCase();
  }
  const fromLocalPath = extname(basename(localPath));
  if (safeExtension(fromLocalPath)) {
    return fromLocalPath.toLowerCase();
  }
  return extensionFromMime(row.mimeType);
}

function extensionFromMime(mimeType: string | null): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'video/mp4':
      return '.mp4';
    case 'application/zip':
      return '.zip';
    default:
      return '';
  }
}

function safeExtension(value: string): boolean {
  return /^\.[A-Za-z0-9]{1,12}$/.test(value);
}

function isExistingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'EEXIST'
  );
}

function parseTdlibInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (Number.isSafeInteger(parsed)) {
    return parsed;
  }
  throw new Error(`Telegram ${label} must be a safe integer: ${value}`);
}

export function logWorkerError(error: unknown): void {
  logger.warn(
    {
      event: 'telegram.file_subsystem_worker_failed',
      ...logError(error)
    },
    'telegram file subsystem worker failed'
  );
}

export function logTdlibCleanupError(assetKey: string, error: unknown): void {
  if (isTdlibMissingFileError(error)) {
    return;
  }
  logger.warn(
    {
      assetKey,
      event: 'telegram.file_download_cleanup_failed',
      ...logError(error)
    },
    'telegram file download cleanup failed'
  );
}

function logFileDownloadFailed(
  source: 'batch' | 'completed' | 'stale',
  row: { assetKey: string; transport?: FileDownloadTransport },
  error: unknown
): void {
  logger.warn(
    {
      assetKey: row.assetKey,
      event: 'telegram.file_download_failed',
      source,
      transport: row.transport?.kind ?? 'unknown',
      ...logError(error)
    },
    'telegram file download failed'
  );
}

function isTdlibMissingFileError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Can't find file");
}
