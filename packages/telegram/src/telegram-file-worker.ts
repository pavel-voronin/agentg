import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { EventBus } from '@agentg/events/bus';
import { and, eq } from 'drizzle-orm';

import type { TelegramDatabase as AppDatabase } from './database.js';
import {
  createTelegramChatUpdatedEvent,
  createTelegramFileQueueUpdatedEvent,
  createTelegramReadMessageUpdatedEvent
} from './integration-events.js';
import { telegramMessageModelParts } from './model-refs.js';
import { asTdObject, type TdObject } from './normalize.js';
import { telegramMessages } from './schema.js';
import {
  claimNextQueuedTelegramFileDownload,
  markTelegramFileDownloadDispatched,
  markTelegramFileDownloadFailed,
  markTelegramFileDownloadReady,
  readTelegramFileOwnersForAsset,
  readTelegramFileQueueStats,
  readStaleTelegramFileDownloadRows,
  readTelegramFileDownloadRow,
  type StoredCanonicalFile,
  type TelegramCompletedFileAsset,
  type TelegramFileDownloadRow,
  type TelegramFileOwnerKey
} from './telegram-file-store.js';
import { invokeTdlibWithEvents, type TdlibInvoker } from './telegram-operation-events.js';
import { assertTelegramTdlibPriority, telegramTdlibPriorities } from './telegram-tdlib-priority.js';
import { isTelegramTdlibUnderNavigationPressure } from './telegram-tdlib-scheduler.js';
import {
  getDirectoryEntryByChatId,
  readMessageSelection,
  toReadMessages
} from './rpc/procedures/support.js';

export type TelegramFileDownloadWorker = {
  close(): void;
  enqueueCompletedFile(file: TelegramCompletedFileAsset): void;
};

export type TelegramFileDownloadWorkerOptions = {
  client: TdlibInvoker;
  database: AppDatabase;
  eventBus: EventBus;
  filesDirectory: string;
  failureBackoffMs?: number;
  intervalMs?: number;
  maxConcurrentDownloads?: number;
  maxFilesPerTick?: number;
};

const DEFAULT_WORKER_INTERVAL_MS = 1000;
const DEFAULT_WORKER_FAILURE_BACKOFF_MS = 5000;
const DEFAULT_WORKER_MAX_CONCURRENT_DOWNLOADS = 2;
const DEFAULT_WORKER_MAX_FILES_PER_TICK = 4;
const DOWNLOAD_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;
const CANONICAL_FILES_DIR = 'agentg-media';

export function startTelegramFileDownloadWorker(
  options: TelegramFileDownloadWorkerOptions
): TelegramFileDownloadWorker {
  let closed = false;
  let pending = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const completedFiles = new Map<string, TelegramCompletedFileAsset>();
  const intervalMs = options.intervalMs ?? DEFAULT_WORKER_INTERVAL_MS;
  const failureBackoffMs = options.failureBackoffMs ?? DEFAULT_WORKER_FAILURE_BACKOFF_MS;
  const maxConcurrentDownloads = positiveInteger(
    options.maxConcurrentDownloads,
    DEFAULT_WORKER_MAX_CONCURRENT_DOWNLOADS
  );
  const maxFilesPerTick = positiveInteger(
    options.maxFilesPerTick,
    DEFAULT_WORKER_MAX_FILES_PER_TICK
  );

  const schedule = (delayMs = intervalMs): void => {
    if (closed) {
      return;
    }
    if (running) {
      pending = true;
      return;
    }
    if (timer !== undefined) {
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      runTick();
    }, delayMs);
    timer.unref();
  };

  const runTick = (): void => {
    if (closed) {
      return;
    }
    if (running) {
      pending = true;
      return;
    }
    running = true;
    void tick().then(handleTickResult, handleTickError);
  };

  const handleTickResult = (result: TelegramFileDownloadBatchResult): void => {
    running = false;
    if (closed) {
      return;
    }
    if (pending) {
      pending = false;
      schedule(0);
      return;
    }
    schedule(result.failedCount > 0 && result.readyCount === 0 ? failureBackoffMs : intervalMs);
  };

  const handleTickError = (error: unknown): void => {
    running = false;
    logWorkerError(error);
    if (closed) {
      return;
    }
    if (pending) {
      pending = false;
      schedule(0);
      return;
    }
    schedule(failureBackoffMs);
  };

  const tick = async (): Promise<TelegramFileDownloadBatchResult> => {
    const canonicalized = await processCompletedFileBatch(options, completedFiles, maxFilesPerTick);
    if (isTelegramTdlibUnderNavigationPressure(options.client)) {
      return {
        failedCount: canonicalized.failedCount,
        processedCount: canonicalized.processedCount,
        readyCount: canonicalized.readyCount
      };
    }
    const queued = await processQueuedFileBatch(options, {
      maxConcurrentDownloads,
      maxFilesPerTick
    });
    return {
      failedCount: canonicalized.failedCount + queued.failedCount,
      processedCount: canonicalized.processedCount + queued.processedCount,
      readyCount: canonicalized.readyCount + queued.readyCount
    };
  };

  runTick();

  return {
    close(): void {
      closed = true;
      pending = false;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
    enqueueCompletedFile(file: TelegramCompletedFileAsset): void {
      if (closed) {
        return;
      }
      completedFiles.set(file.assetKey, file);
      if (timer !== undefined && !running) {
        clearTimeout(timer);
        timer = undefined;
      }
      schedule(0);
    }
  };
}

export async function processNextQueuedFile(
  options: TelegramFileDownloadWorkerOptions
): Promise<boolean> {
  await reconcileStaleFileDownloads(options, 1);
  const row = await claimNextQueuedTelegramFileDownload(options.database);
  if (row === null) {
    return false;
  }
  await publishTelegramFileQueueUpdated(options.database, options.eventBus);
  await processClaimedFile(options, row);
  await publishTelegramFileAssetOwnersUpdated(options.database, options.eventBus, row.assetKey);
  await publishTelegramFileQueueUpdated(options.database, options.eventBus);
  return true;
}

export type TelegramFileDownloadBatchResult = {
  failedCount: number;
  processedCount: number;
  readyCount: number;
};

export async function processQueuedFileBatch(
  options: TelegramFileDownloadWorkerOptions,
  limits: {
    maxConcurrentDownloads: number;
    maxFilesPerTick: number;
  }
): Promise<TelegramFileDownloadBatchResult> {
  const rows: TelegramFileDownloadRow[] = [];
  const maxFilesPerTick = positiveInteger(
    limits.maxFilesPerTick,
    DEFAULT_WORKER_MAX_FILES_PER_TICK
  );
  const reconciled = await reconcileStaleFileDownloads(options, maxFilesPerTick);
  const maxConcurrentDownloads = positiveInteger(
    limits.maxConcurrentDownloads,
    DEFAULT_WORKER_MAX_CONCURRENT_DOWNLOADS
  );

  for (let index = 0; index < maxFilesPerTick; index += 1) {
    if (isTelegramTdlibUnderNavigationPressure(options.client)) {
      break;
    }
    const row = await claimNextQueuedTelegramFileDownload(options.database);
    if (row === null) {
      break;
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    return {
      failedCount: reconciled.failedCount,
      processedCount: reconciled.processedCount,
      readyCount: reconciled.readyCount
    };
  }

  await publishTelegramFileQueueUpdated(options.database, options.eventBus);
  const results: TelegramFileDownloadResult[] = [];
  for (let index = 0; index < rows.length; index += maxConcurrentDownloads) {
    const batch = rows.slice(index, index + maxConcurrentDownloads);
    results.push(...(await Promise.all(batch.map((row) => processClaimedFile(options, row)))));
  }

  const assetKeys = [...new Set(results.map((result) => result.assetKey))];
  for (const assetKey of assetKeys) {
    await publishTelegramFileAssetOwnersUpdated(options.database, options.eventBus, assetKey);
  }
  await publishTelegramFileQueueUpdated(options.database, options.eventBus);

  return {
    failedCount: reconciled.failedCount + results.filter((result) => result.failed).length,
    processedCount: reconciled.processedCount + results.length,
    readyCount: reconciled.readyCount + results.filter((result) => result.ready).length
  };
}

type TelegramFileDownloadResult = {
  assetKey: string;
  failed: boolean;
  ready: boolean;
};

async function processClaimedFile(
  options: TelegramFileDownloadWorkerOptions,
  row: TelegramFileDownloadRow
): Promise<TelegramFileDownloadResult> {
  try {
    const file = await dispatchTdlibFileDownload(options, row);
    const completedFile = completedFileAssetFromTdlibFile(row.assetKey, file);
    if (completedFile !== null) {
      await canonicalizeCompletedTelegramFile(options, completedFile, false);
      return {
        assetKey: row.assetKey,
        failed: false,
        ready: true
      };
    }
    await markTelegramFileDownloadDispatched(options.database, row.assetKey);
    return {
      assetKey: row.assetKey,
      failed: false,
      ready: false
    };
  } catch (error) {
    await markTelegramFileDownloadFailed(options.database, row.assetKey, error);
    return {
      assetKey: row.assetKey,
      failed: true,
      ready: false
    };
  }
}

async function reconcileStaleFileDownloads(
  options: TelegramFileDownloadWorkerOptions,
  limit: number
): Promise<TelegramFileDownloadBatchResult> {
  const staleBefore = new Date(Date.now() - DOWNLOAD_CLAIM_TIMEOUT_MS);
  const rows = await readStaleTelegramFileDownloadRows(options.database, staleBefore, limit);
  if (rows.length === 0) {
    return emptyBatchResult();
  }

  const results: TelegramFileDownloadResult[] = [];
  for (const row of rows) {
    results.push(await reconcileStaleFileDownload(options, row));
  }
  for (const assetKey of new Set(results.map((result) => result.assetKey))) {
    await publishTelegramFileAssetOwnersUpdated(options.database, options.eventBus, assetKey);
  }
  await publishTelegramFileQueueUpdated(options.database, options.eventBus);
  return {
    failedCount: results.filter((result) => result.failed).length,
    processedCount: results.length,
    readyCount: results.filter((result) => result.ready).length
  };
}

async function reconcileStaleFileDownload(
  options: TelegramFileDownloadWorkerOptions,
  row: TelegramFileDownloadRow
): Promise<TelegramFileDownloadResult> {
  try {
    const file = await getTdlibFile(options, row);
    const completedFile = completedFileAssetFromTdlibFile(row.assetKey, file);
    if (completedFile !== null) {
      await canonicalizeCompletedTelegramFile(options, completedFile, false);
      return {
        assetKey: row.assetKey,
        failed: false,
        ready: true
      };
    }
    await dispatchTdlibFileDownload(options, row);
    await markTelegramFileDownloadDispatched(options.database, row.assetKey);
    return {
      assetKey: row.assetKey,
      failed: false,
      ready: false
    };
  } catch (error) {
    await markTelegramFileDownloadFailed(options.database, row.assetKey, error);
    return {
      assetKey: row.assetKey,
      failed: true,
      ready: false
    };
  }
}

async function dispatchTdlibFileDownload(
  options: TelegramFileDownloadWorkerOptions,
  row: TelegramFileDownloadRow
): Promise<TdObject | undefined> {
  if (row.latestTdlibFileId === null) {
    throw new Error(`Telegram file asset has no TDLib file id: ${row.assetKey}`);
  }

  return asTdObject(
    await invokeTdlibWithEvents(
      options.eventBus,
      options.client,
      telegramFileDownloadRequest(row),
      {
        priority: row.priority
      }
    )
  );
}

async function getTdlibFile(
  options: TelegramFileDownloadWorkerOptions,
  row: TelegramFileDownloadRow
): Promise<TdObject | undefined> {
  if (row.latestTdlibFileId === null) {
    throw new Error(`Telegram file asset has no TDLib file id: ${row.assetKey}`);
  }
  return asTdObject(
    await invokeTdlibWithEvents(
      options.eventBus,
      options.client,
      {
        _: 'getFile',
        file_id: row.latestTdlibFileId
      },
      {
        priority: telegramTdlibPriorities.low
      }
    )
  );
}

export function telegramFileDownloadRequest(row: TelegramFileDownloadRow): Record<string, unknown> {
  if (row.latestTdlibFileId === null) {
    throw new Error(`Telegram file asset has no TDLib file id: ${row.assetKey}`);
  }
  const priority = assertTelegramTdlibPriority(row.priority);
  if (row.transport.kind === 'message') {
    return {
      _: 'addFileToDownloads',
      chat_id: row.transport.chatId,
      file_id: row.latestTdlibFileId,
      message_id: row.transport.messageId,
      priority
    };
  }
  return {
    _: 'downloadFile',
    file_id: row.latestTdlibFileId,
    limit: 0,
    offset: 0,
    priority,
    synchronous: false
  };
}

async function processCompletedFileBatch(
  options: TelegramFileDownloadWorkerOptions,
  completedFiles: Map<string, TelegramCompletedFileAsset>,
  limit: number
): Promise<TelegramFileDownloadBatchResult> {
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
      await canonicalizeCompletedTelegramFile(options, file);
      readyCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return {
    failedCount,
    processedCount: files.length,
    readyCount
  };
}

export async function canonicalizeCompletedTelegramFile(
  options: TelegramFileDownloadWorkerOptions,
  file: TelegramCompletedFileAsset,
  publishUpdates = true
): Promise<void> {
  const row = await readTelegramFileDownloadRow(options.database, file.assetKey);
  if (row === null) {
    return;
  }
  if (row.latestTdlibFileId !== file.tdlibFileId) {
    return;
  }

  try {
    const stored = await storeCanonicalFile(options.filesDirectory, file.localPath, row);
    await markTelegramFileDownloadReady(options.database, file.assetKey, stored);
    await cleanupTdlibFile(options, row);
  } catch (error) {
    await markTelegramFileDownloadFailed(options.database, file.assetKey, error);
    throw error;
  } finally {
    if (publishUpdates) {
      await publishTelegramFileAssetOwnersUpdated(
        options.database,
        options.eventBus,
        file.assetKey
      );
      await publishTelegramFileQueueUpdated(options.database, options.eventBus);
    }
  }
}

async function storeCanonicalFile(
  filesDirectory: string,
  localPath: string,
  row: TelegramFileDownloadRow
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

export async function publishTelegramFileOwnerUpdated(
  database: AppDatabase,
  eventBus: EventBus,
  owner: TelegramFileOwnerKey
): Promise<void> {
  if (owner.ownerModel === 'telegram.chat') {
    const chat = await getDirectoryEntryByChatId(database, owner.ownerId);
    if (chat !== null) {
      eventBus.publish(createTelegramChatUpdatedEvent(chat));
    }
    return;
  }

  const parts = telegramMessageModelParts(owner.ownerId);
  if (parts === null) {
    return;
  }
  const [message] = await database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(
      and(
        eq(telegramMessages.telegramChatId, parts.chatId),
        eq(telegramMessages.telegramMessageId, parts.messageId)
      )
    )
    .limit(1);
  const [readMessage] = await toReadMessages(database, message === undefined ? [] : [message]);
  if (readMessage !== undefined) {
    eventBus.publish(createTelegramReadMessageUpdatedEvent(readMessage));
  }
}

async function publishTelegramFileAssetOwnersUpdated(
  database: AppDatabase,
  eventBus: EventBus,
  assetKey: string
): Promise<void> {
  const owners = await readTelegramFileOwnersForAsset(database, assetKey);
  for (const owner of owners) {
    await publishTelegramFileOwnerUpdated(database, eventBus, owner);
  }
}

export async function publishTelegramFileQueueUpdated(
  database: AppDatabase,
  eventBus: EventBus
): Promise<void> {
  eventBus.publish(createTelegramFileQueueUpdatedEvent(await readTelegramFileQueueStats(database)));
}

function completedFileAssetFromTdlibFile(
  assetKey: string,
  file: TdObject | undefined
): TelegramCompletedFileAsset | null {
  const local = asPlainRecord(file?.local);
  const path = localFilePath(file);
  const fileId = typeof file?.id === 'number' && Number.isSafeInteger(file.id) ? file.id : null;
  if (local?.is_downloading_completed === true && path !== null && fileId !== null) {
    return {
      assetKey,
      localPath: path,
      tdlibFileId: fileId
    };
  }
  return null;
}

async function cleanupTdlibFile(
  options: TelegramFileDownloadWorkerOptions,
  row: TelegramFileDownloadRow
): Promise<void> {
  if (row.latestTdlibFileId === null) {
    return;
  }
  const request =
    row.transport.kind === 'message'
      ? {
          _: 'removeFileFromDownloads',
          delete_from_cache: true,
          file_id: row.latestTdlibFileId
        }
      : {
          _: 'deleteFile',
          file_id: row.latestTdlibFileId
        };
  try {
    await invokeTdlibWithEvents(options.eventBus, options.client, request, {
      priority: telegramTdlibPriorities.low
    });
  } catch (error) {
    logTdlibCleanupError(row.assetKey, error);
  }
}

function emptyBatchResult(): TelegramFileDownloadBatchResult {
  return {
    failedCount: 0,
    processedCount: 0,
    readyCount: 0
  };
}

function localFilePath(file: TdObject | undefined): string | null {
  const local = asPlainRecord(file?.local);
  const path = local?.path;
  return typeof path === 'string' && path.length > 0 ? path : null;
}

function fileExtension(row: TelegramFileDownloadRow, localPath: string): string {
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

function logWorkerError(error: unknown): void {
  console.warn(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'telegram.file_download_worker_failed'
    })
  );
}

function logTdlibCleanupError(assetKey: string, error: unknown): void {
  console.warn(
    JSON.stringify({
      assetKey,
      error: error instanceof Error ? error.message : String(error),
      event: 'telegram.file_download_cleanup_failed'
    })
  );
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
