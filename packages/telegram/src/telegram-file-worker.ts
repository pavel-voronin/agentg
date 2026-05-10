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
  markTelegramFileDownloadFailed,
  markTelegramFileDownloadReady,
  readTelegramFileOwnersForAsset,
  readTelegramFileQueueStats,
  requeueStaleTelegramFileDownloads,
  type StoredCanonicalFile,
  type TelegramFileDownloadRow,
  type TelegramFileOwnerKey
} from './telegram-file-store.js';
import { invokeTdlibWithEvents, type TdlibInvoker } from './telegram-operation-events.js';
import { isTelegramTdlibUnderNavigationPressure } from './telegram-tdlib-scheduler.js';
import {
  getDirectoryEntryByChatId,
  readMessageSelection,
  toReadMessages
} from './rpc/procedures/support.js';

export type TelegramFileDownloadWorker = {
  close(): void;
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
  let timer: ReturnType<typeof setTimeout> | undefined;
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
    timer = setTimeout(() => {
      void tick().then((result) => {
        schedule(result.failedCount > 0 && result.readyCount === 0 ? failureBackoffMs : intervalMs);
      }, logWorkerErrorAndSchedule);
    }, delayMs);
    timer.unref();
  };

  const logWorkerErrorAndSchedule = (error: unknown): void => {
    logWorkerError(error);
    schedule(failureBackoffMs);
  };

  const tick = async (): Promise<TelegramFileDownloadBatchResult> => {
    if (isTelegramTdlibUnderNavigationPressure(options.client)) {
      return {
        failedCount: 0,
        processedCount: 0,
        readyCount: 0
      };
    }
    return processQueuedFileBatch(options, {
      maxConcurrentDownloads,
      maxFilesPerTick
    });
  };

  void tick().catch(logWorkerError).finally(schedule);

  return {
    close(): void {
      closed = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    }
  };
}

export async function processNextQueuedFile(
  options: TelegramFileDownloadWorkerOptions
): Promise<boolean> {
  await recoverStaleFileDownloads(options);
  const row = await claimNextQueuedTelegramFileDownload(options.database);
  if (row === null) {
    return false;
  }
  await publishTelegramFileQueueUpdated(options.database, options.eventBus);

  try {
    const localPath = await downloadTdlibFile(options, row);
    const stored = await storeCanonicalFile(options.filesDirectory, localPath, row);
    await markTelegramFileDownloadReady(options.database, row.assetKey, stored);
  } catch (error) {
    await markTelegramFileDownloadFailed(options.database, row.assetKey, error);
  }

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
  await recoverStaleFileDownloads(options);
  const rows: TelegramFileDownloadRow[] = [];
  const maxFilesPerTick = positiveInteger(
    limits.maxFilesPerTick,
    DEFAULT_WORKER_MAX_FILES_PER_TICK
  );
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
      failedCount: 0,
      processedCount: 0,
      readyCount: 0
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
    failedCount: results.filter((result) => !result.ready).length,
    processedCount: results.length,
    readyCount: results.filter((result) => result.ready).length
  };
}

type TelegramFileDownloadResult = {
  assetKey: string;
  ready: boolean;
};

async function processClaimedFile(
  options: TelegramFileDownloadWorkerOptions,
  row: TelegramFileDownloadRow
): Promise<TelegramFileDownloadResult> {
  try {
    const localPath = await downloadTdlibFile(options, row);
    const stored = await storeCanonicalFile(options.filesDirectory, localPath, row);
    await markTelegramFileDownloadReady(options.database, row.assetKey, stored);
    return {
      assetKey: row.assetKey,
      ready: true
    };
  } catch (error) {
    await markTelegramFileDownloadFailed(options.database, row.assetKey, error);
    return {
      assetKey: row.assetKey,
      ready: false
    };
  }
}

async function recoverStaleFileDownloads(
  options: TelegramFileDownloadWorkerOptions
): Promise<void> {
  const staleBefore = new Date(Date.now() - DOWNLOAD_CLAIM_TIMEOUT_MS);
  const owners = await requeueStaleTelegramFileDownloads(options.database, staleBefore);
  if (owners.length === 0) {
    return;
  }

  for (const owner of owners) {
    await publishTelegramFileOwnerUpdated(options.database, options.eventBus, owner);
  }
  await publishTelegramFileQueueUpdated(options.database, options.eventBus);
}

async function downloadTdlibFile(
  options: TelegramFileDownloadWorkerOptions,
  row: TelegramFileDownloadRow
): Promise<string> {
  if (row.latestTdlibFileId === null) {
    throw new Error(`Telegram file asset has no TDLib file id: ${row.assetKey}`);
  }

  const file = asTdObject(
    await invokeTdlibWithEvents(
      options.eventBus,
      options.client,
      {
        _: 'downloadFile',
        file_id: row.latestTdlibFileId,
        limit: 0,
        offset: 0,
        priority: 1,
        synchronous: true
      },
      {
        priority: row.priority
      }
    )
  );
  const localPath = localFilePath(file);
  if (localPath === null) {
    throw new Error(`TDLib did not return a local path for file ${String(row.latestTdlibFileId)}`);
  }
  return localPath;
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

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
