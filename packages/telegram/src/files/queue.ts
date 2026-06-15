import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { basename, extname, join, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { createLogger, logContext, logError } from '@agentg/framework';
import { and, eq, sql } from 'drizzle-orm';
import type { Message, file } from 'tdlib-types';

import type { Database } from '../database/client.js';
import {
  telegramFileAssets,
  telegramFileDownloadJobs,
  telegramFileSlots,
  telegramTdlibFiles
} from '../database/schema.js';
import { MESSAGE_MODEL, messageModelParts } from '../model/refs.js';
import { assertPriority, priorities } from '../tdlib/priority.js';
import { tdFileOrUndefined, tdJsonObject } from '../tdlib/shape.js';
import { publishAssetOwnersAndQueue, publishFileQueueUpdated } from './events.js';
import { handleFileSnapshot, refreshMessageFileSlot } from './persistence.js';
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
  DEFAULT_WORKER_DOWNLOAD_CLAIM_TIMEOUT_MS,
  DEFAULT_WORKER_MAX_CONCURRENT_DOWNLOADS,
  DEFAULT_WORKER_MAX_FILES_PER_TICK,
  completedFileAssetFromTdlibFile,
  emptyBatchResult,
  positiveInteger,
  shouldDeferFileDownloads
} from './runtime.js';
import {
  recordWorkerBatchResult,
  recordWorkerJobs,
  recordWorkerRecoveryOutcome,
  timeWorkerStage
} from './telemetry.js';

const MAX_STALE_DOWNLOAD_ATTEMPTS = 3;
const logger = createLogger('telegram');

type StaleFileDownloadRows = {
  hasMore: boolean;
  rows: FileDownloadRow[];
};

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
        reconciled.watchdogCount +
        (reconciled.processedCount === 0 ? await hasDownloadingFileDownloads(options.database) : 0)
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
    const downloadRow = await timeWorkerStage('validate_tdlib_pointer', () =>
      resolveDownloadRow(options, row)
    );
    const file = await timeWorkerStage('dispatch_tdlib', () =>
      dispatchTdlibFileDownload(options, downloadRow)
    );
    const completedFile = completedFileAssetFromTdlibFile(file);
    if (completedFile !== null) {
      await timeWorkerStage('canonicalize_completed', () =>
        canonicalizeCompletedFile(options, {
          ...completedFile,
          assetKey: downloadRow.assetKey
        })
      );
      return {
        assetKey: downloadRow.assetKey,
        failed: false,
        ready: true
      };
    }
    await markFileDownloadDispatched(options.database, downloadRow.assetKey);
    return {
      assetKey: downloadRow.assetKey,
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
  const staleBefore = new Date(Date.now() - DEFAULT_WORKER_DOWNLOAD_CLAIM_TIMEOUT_MS);
  const { hasMore, rows } = await readStaleFileDownloadRows(options.database, staleBefore, limit);
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
    immediateCount: hasMore ? 1 : 0,
    processedCount: results.length,
    readyCount,
    watchdogCount: downloadingCount
  };
}

async function readStaleFileDownloadRows(
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

async function reconcileStaleFileDownload(
  options: FileSubsystemOptions,
  row: FileDownloadRow
): Promise<FileDownloadResult> {
  try {
    const downloadRow = await timeWorkerStage('validate_tdlib_pointer', () =>
      resolveDownloadRow(options, row)
    );
    const file = await timeWorkerStage('inspect_tdlib', () => getTdlibFile(options, downloadRow));
    const completedFile = completedFileAssetFromTdlibFile(file);
    if (completedFile !== null) {
      await timeWorkerStage('canonicalize_completed', () =>
        canonicalizeCompletedFile(options, {
          ...completedFile,
          assetKey: downloadRow.assetKey
        })
      );
      return {
        assetKey: downloadRow.assetKey,
        failed: false,
        ready: true
      };
    }
    if (file !== undefined) {
      const changedAssets = await handleFileSnapshot(options.database, file);
      if (changedAssets.includes(downloadRow.assetKey)) {
        await refreshFileDownloadClaim(options.database, downloadRow.assetKey);
        return {
          assetKey: downloadRow.assetKey,
          failed: false,
          ready: false
        };
      }
    }
    if (downloadRow.attempts >= MAX_STALE_DOWNLOAD_ATTEMPTS) {
      logStaleFileDownloadDecision('retry_limit', downloadRow, file);
      throw new Error(
        `Telegram file download stale retry limit reached after ${String(downloadRow.attempts)} attempts`
      );
    }
    await timeWorkerStage('dispatch_tdlib', () => dispatchTdlibFileDownload(options, downloadRow));
    await markFileDownloadRedispatched(options.database, downloadRow.assetKey);
    logStaleFileDownloadDecision('redispatched', downloadRow, file);
    return {
      assetKey: downloadRow.assetKey,
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

async function resolveDownloadRow(
  options: FileSubsystemOptions,
  row: FileDownloadRow
): Promise<FileDownloadRow> {
  const expectedRemoteUniqueId = assetRemoteUniqueId(row.assetKey);
  if (expectedRemoteUniqueId === null || row.remoteUniqueId === expectedRemoteUniqueId) {
    return row;
  }

  if (row.transport.kind !== 'message') {
    recordWorkerRecoveryOutcome('unsupported_owner', row.transport.kind);
    throw stalePointerError(
      row,
      expectedRemoteUniqueId,
      'non-message assets need owner-specific recovery'
    );
  }

  const messageRow = {
    ...row,
    transport: row.transport
  };
  return timeWorkerStage('recover_message_slot', () =>
    recoverMessageDownloadRow(options, messageRow, expectedRemoteUniqueId)
  );
}

async function recoverMessageDownloadRow(
  options: FileSubsystemOptions,
  row: FileDownloadRow & { transport: Extract<FileDownloadTransport, { kind: 'message' }> },
  expectedRemoteUniqueId: string
): Promise<FileDownloadRow> {
  if (row.slotKey === null) {
    recordWorkerRecoveryOutcome('slot_missing', row.transport.kind);
    throw stalePointerError(row, expectedRemoteUniqueId, 'message asset has no slot key');
  }

  const message = await readMessageForRecovery(options, row, expectedRemoteUniqueId);
  const result = await refreshMessageFileSlot(options.database, {
    assetKey: row.assetKey,
    chatId: String(row.transport.chatId),
    content: tdJsonObject(message.content),
    messageId: String(row.transport.messageId),
    slotKey: row.slotKey
  });

  if (result.kind === 'slot_missing') {
    recordWorkerRecoveryOutcome('slot_missing', row.transport.kind);
    throw stalePointerError(
      row,
      expectedRemoteUniqueId,
      'message no longer contains the file slot'
    );
  }
  if (result.kind === 'asset_changed') {
    recordWorkerRecoveryOutcome('asset_changed', row.transport.kind);
    throw stalePointerError(
      row,
      expectedRemoteUniqueId,
      `message slot now points at ${result.assetKey}`
    );
  }

  const refreshed = await readFileDownloadRow(options.database, row.assetKey);
  if (refreshed?.remoteUniqueId !== expectedRemoteUniqueId) {
    recordWorkerRecoveryOutcome('slot_missing', row.transport.kind);
    throw stalePointerError(
      row,
      expectedRemoteUniqueId,
      'message slot refresh did not update the asset pointer'
    );
  }
  recordWorkerRecoveryOutcome('refreshed', row.transport.kind);
  return refreshed;
}

async function readMessageForRecovery(
  options: FileSubsystemOptions,
  row: FileDownloadRow & { transport: Extract<FileDownloadTransport, { kind: 'message' }> },
  expectedRemoteUniqueId: string
): Promise<Message> {
  try {
    return await options.tdlib.getMessage(
      {
        chatId: row.transport.chatId,
        messageId: row.transport.messageId
      },
      {
        priority: assertPriority(row.priority)
      }
    );
  } catch (error) {
    recordWorkerRecoveryOutcome('message_unavailable', row.transport.kind);
    throw stalePointerError(row, expectedRemoteUniqueId, errorMessage(error));
  }
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
    const stored = await storeCanonicalFile(
      options.filesDirectory,
      options.tdlibSourceDirectories,
      file.localPath,
      row
    );
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

async function refreshFileDownloadClaim(database: Database, assetKey: string): Promise<void> {
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

async function markFileDownloadRedispatched(database: Database, assetKey: string): Promise<void> {
  await database
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
  sourceDirectories: readonly string[],
  localPath: string,
  row: FileDownloadRow
): Promise<StoredCanonicalFile> {
  const filesRoot = await realpath(filesDirectory);
  const root = await resolveCanonicalFilesRoot(filesRoot);
  const sourceRoots = await resolveTdlibSourceRoots(sourceDirectories);
  const safeLocalPath = await resolveTdlibLocalFilePath(sourceRoots, root, localPath);
  const temporaryPath = join(root, `.tmp-${randomUUID()}`);
  try {
    const hash = createHash('sha256');
    const input = createReadStream(safeLocalPath);
    input.on('data', (chunk: Buffer | string) => {
      hash.update(chunk);
    });
    await pipeline(input, createWriteStream(temporaryPath));
    const sha256 = hash.digest('hex');
    const byteSize = (await stat(temporaryPath)).size;
    const extension = fileExtension(row, safeLocalPath);
    const relativePath = `${CANONICAL_FILES_DIR}/${sha256}${extension}`;
    const canonicalPath = join(root, `${sha256}${extension}`);

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
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function resolveTdlibSourceRoots(sourceDirectories: readonly string[]): Promise<string[]> {
  if (sourceDirectories.length === 0) {
    throw new Error('Telegram TDLib source directories are not configured');
  }
  const roots = await Promise.all(sourceDirectories.map((directory) => realpath(directory)));
  return [...new Set(roots)];
}

async function resolveCanonicalFilesRoot(filesRoot: string): Promise<string> {
  const root = resolve(filesRoot, CANONICAL_FILES_DIR);
  await mkdir(root, { recursive: true });
  const canonicalRoot = await realpath(root);
  if (!isPathInsideDirectory(filesRoot, canonicalRoot)) {
    throw new Error('Telegram canonical media storage is outside the configured files directory');
  }
  return canonicalRoot;
}

async function resolveTdlibLocalFilePath(
  sourceRoots: readonly string[],
  canonicalRoot: string,
  localPath: string
): Promise<string> {
  const candidate = await realpath(localPath);
  if (!sourceRoots.some((root) => candidate === root || isPathInsideDirectory(root, candidate))) {
    throw new Error('Telegram TDLib local file path is outside the configured source directories');
  }
  if (candidate === canonicalRoot || isPathInsideDirectory(canonicalRoot, candidate)) {
    throw new Error('Telegram TDLib local file path points at canonical media storage');
  }
  return candidate;
}

function isPathInsideDirectory(root: string, candidate: string): boolean {
  const rootWithSeparator = root.endsWith(sep) ? root : `${root}${sep}`;
  return candidate.startsWith(rootWithSeparator);
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
      ...logContext({ assetKey }),
      ...logError(error)
    },
    'telegram file download cleanup failed'
  );
}

function logStaleFileDownloadDecision(
  decision: 'redispatched' | 'retry_limit',
  row: FileDownloadRow,
  file: file | undefined
): void {
  const event =
    decision === 'retry_limit'
      ? 'telegram.file_download_stale_retry_limit'
      : 'telegram.file_download_stale_redispatched';
  const level = decision === 'retry_limit' ? 'warn' : 'info';
  const rowFields = fileDownloadRowLogFields(row);
  const snapshotFields = tdlibFileSnapshotLogFields(file);
  const contextFields = {
    ...rowFields,
    ...snapshotFields,
    decision,
    nextAttempt: decision === 'redispatched' ? row.attempts + 1 : row.attempts
  };
  const message = staleFileDownloadDecisionMessage(decision, contextFields);
  logger[level](
    {
      ...rowFields,
      decision,
      event,
      nextAttempt: decision === 'redispatched' ? row.attempts + 1 : row.attempts,
      ...snapshotFields,
      ...logContext(contextFields)
    },
    message
  );
}

function staleFileDownloadDecisionMessage(
  decision: 'redispatched' | 'retry_limit',
  fields: ReturnType<typeof fileDownloadRowLogFields> &
    ReturnType<typeof tdlibFileSnapshotLogFields> & {
      decision: 'redispatched' | 'retry_limit';
      nextAttempt: number;
    }
): string {
  const action =
    decision === 'retry_limit'
      ? 'telegram file download reached stale retry limit'
      : 'telegram file download was redispatched after stale snapshot';
  return [
    action,
    `asset=${formatLogValue(fields.assetKey)}`,
    `attempts=${formatLogValue(fields.attempts)}`,
    `next=${formatLogValue(fields.nextAttempt)}`,
    `owner=${formatLogValue(fields.ownerModel)}`,
    `ownerId=${formatLogValue(fields.ownerId)}`,
    `slot=${formatLogValue(fields.slotKey)}`,
    `media=${formatLogValue(fields.mediaKind)}`,
    `tdlib=${formatLogValue(fields.tdlibFileId)}`,
    `tdlibDownloaded=${formatLogValue(fields.tdlibLocalDownloadedSize)}`,
    `tdlibActive=${formatLogValue(fields.tdlibLocalIsDownloadingActive)}`,
    `tdlibCompleted=${formatLogValue(fields.tdlibLocalIsDownloadingCompleted)}`,
    `tdlibPath=${formatLogValue(fields.tdlibLocalPath)}`
  ].join(' ');
}

function formatLogValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return JSON.stringify(value);
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
      ...logContext({
        assetKey: row.assetKey,
        source,
        transport: row.transport?.kind ?? 'unknown'
      }),
      ...logError(error)
    },
    'telegram file download failed'
  );
}

function fileDownloadRowLogFields(row: FileDownloadRow) {
  return {
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
    transport: row.transport.kind
  };
}

function tdlibFileSnapshotLogFields(file: file | undefined) {
  return {
    tdlibExpectedSize: file?.expected_size ?? null,
    tdlibFileId: file?.id ?? null,
    tdlibLocalCanBeDeleted: file?.local.can_be_deleted ?? null,
    tdlibLocalCanBeDownloaded: file?.local.can_be_downloaded ?? null,
    tdlibLocalDownloadOffset: file?.local.download_offset ?? null,
    tdlibLocalDownloadedPrefixSize: file?.local.downloaded_prefix_size ?? null,
    tdlibLocalDownloadedSize: file?.local.downloaded_size ?? null,
    tdlibLocalIsDownloadingActive: file?.local.is_downloading_active ?? null,
    tdlibLocalIsDownloadingCompleted: file?.local.is_downloading_completed ?? null,
    tdlibLocalPath: file?.local.path ?? null,
    tdlibRemoteId: file?.remote.id ?? null,
    tdlibRemoteIsUploadingActive: file?.remote.is_uploading_active ?? null,
    tdlibRemoteIsUploadingCompleted: file?.remote.is_uploading_completed ?? null,
    tdlibRemoteUniqueId: file?.remote.unique_id ?? null,
    tdlibRemoteUploadedSize: file?.remote.uploaded_size ?? null,
    tdlibSize: file?.size ?? null,
    tdlibSnapshotPresent: file !== undefined
  };
}

function isTdlibMissingFileError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Can't find file");
}

function assetRemoteUniqueId(assetKey: string): string | null {
  const prefix = 'telegram:';
  return assetKey.startsWith(prefix) && assetKey.length > prefix.length
    ? assetKey.slice(prefix.length)
    : null;
}

function stalePointerError(
  row: FileDownloadRow,
  expectedRemoteUniqueId: string,
  reason: string
): Error {
  return new Error(
    [
      'Telegram file asset TDLib pointer is stale',
      `asset=${row.assetKey}`,
      `expectedRemoteUniqueId=${expectedRemoteUniqueId}`,
      `currentRemoteUniqueId=${row.remoteUniqueId ?? '-'}`,
      `tdlibFileId=${String(row.latestTdlibFileId ?? '-')}`,
      `reason=${reason}`
    ].join(' ')
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
