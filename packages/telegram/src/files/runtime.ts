import type { EventBus, JsonObject } from '@agentg/framework';

import type { Database } from '../database/client.js';
import type { FileSnapshot } from '../domain/models/fileSnapshot.js';
import type { FileGenerationRequest } from '../domain/models/state.js';
import type { FilePolicyDecision } from './policy.js';
import type { MediaDownloadPolicyRule } from './policyRules.js';
import type { FileRef } from './types.js';

type OperationOptions = {
  priority?: number;
};

type GenerationErrorInput = {
  _: 'error';
  code: number;
  message: string;
};

export type FileOperationPort = {
  addFileToDownloads(
    input: {
      chatId: number;
      fileId: number;
      messageId: number;
      priority: number;
    },
    options?: OperationOptions
  ): Promise<FileSnapshot>;
  deleteFile(input: { fileId: number }, options?: OperationOptions): Promise<void>;
  downloadFile(
    input: {
      fileId: number;
      limit: number;
      offset: number;
      priority: number;
      synchronous: boolean;
    },
    options?: OperationOptions
  ): Promise<FileSnapshot>;
  finishFileGeneration(
    input: {
      error: GenerationErrorInput | null;
      generationId: number | string;
    },
    options?: OperationOptions
  ): Promise<void>;
  getFile(input: { fileId: number }, options?: OperationOptions): Promise<FileSnapshot | undefined>;
  getMessageContent(
    input: {
      chatId: number;
      messageId: number;
    },
    options?: OperationOptions
  ): Promise<JsonObject>;
  getQueueStats(): {
    highestPendingPriority: number | null;
    runningCount: number;
  };
  removeFileFromDownloads(
    input: {
      deleteFromCache: boolean;
      fileId: number;
    },
    options?: OperationOptions
  ): Promise<void>;
  setFileGenerationProgress(
    input: {
      expectedSize: number;
      generationId: number | string;
      localPrefixSize: number;
    },
    options?: OperationOptions
  ): Promise<void>;
};

export type FileSubsystemOptions = {
  database: Database;
  events: EventBus;
  failureBackoffMs?: number;
  fileDownloadDeferMs?: number;
  filesDirectory: string;
  generationDownloadTimeoutMs?: number;
  generationMaxBytes?: number;
  getDownloadRules: () => readonly MediaDownloadPolicyRule[];
  maxConcurrentDownloads?: number;
  maxFilesPerTick?: number;
  operations: FileOperationPort;
  staleCheckMs?: number;
  tdlibSourceDirectories: readonly string[];
};

export type FileRequestResult = {
  decision: FilePolicyDecision;
  file: FileRef | null;
};

export type FileDownloadRow = {
  assetKey: string;
  attempts: number;
  byteSize: number | null;
  downloadedByteSize: number | null;
  fileName: string | null;
  latestTdlibFileId: number | null;
  mediaKind: string | null;
  mimeType: string | null;
  ownerId: string | null;
  ownerModel: string | null;
  priority: number;
  remoteUniqueId: string | null;
  slotKey: string | null;
  transport: FileDownloadTransport;
};

export type FileDownloadTransport =
  | {
      chatId: number;
      kind: 'message';
      messageId: number;
    }
  | {
      kind: 'file';
    };

export type FileDownloadResult = {
  assetKey: string;
  failed: boolean;
  ready: boolean;
};

export type FileDownloadBatchResult = {
  delayedCount: number;
  failedCount: number;
  immediateCount: number;
  processedCount: number;
  readyCount: number;
  watchdogCount: number;
};

export type FileGenerationStartUpdate = FileGenerationRequest;

export type CompletedFileAsset = {
  assetKey: string;
  localPath: string;
  tdlibFileId: number;
};

export type ActiveFileGeneration = {
  controller: AbortController;
  destinationPath: string;
};

export type StoredCanonicalFile = {
  byteSize: number;
  relativePath: string;
  sha256: string;
};

export type FileAssetStatus = 'failed' | 'known' | 'ready';

export const DEFAULT_WORKER_FAILURE_BACKOFF_MS = 5000;
export const DEFAULT_WORKER_FILE_DOWNLOAD_DEFER_MS = 1000;
export const DEFAULT_WORKER_DOWNLOAD_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_WORKER_MAX_CONCURRENT_DOWNLOADS = 2;
export const DEFAULT_WORKER_MAX_FILES_PER_TICK = 4;
export const DEFAULT_WORKER_STALE_CHECK_MS = 1000;
export const CANONICAL_FILES_DIR = 'agentg-media';
const MAXIMUM_TDLIB_PRIORITY = 32;

export function shouldDeferFileDownloads(operations: FileOperationPort): boolean {
  const stats = operations.getQueueStats();
  return stats.runningCount >= 4 || (stats.highestPendingPriority ?? 0) >= MAXIMUM_TDLIB_PRIORITY;
}

export function completedFileAssetFromTdlibFile(
  file: FileSnapshot | undefined
): Omit<CompletedFileAsset, 'assetKey'> | null {
  if (file?.local.is_downloading_completed === true && file.local.path.length > 0) {
    return {
      localPath: file.local.path,
      tdlibFileId: file.id
    };
  }
  return null;
}

export function emptyBatchResult(): FileDownloadBatchResult {
  return {
    delayedCount: 0,
    failedCount: 0,
    immediateCount: 0,
    processedCount: 0,
    readyCount: 0,
    watchdogCount: 0
  };
}

export function positiveInteger(value: number | undefined, defaultValue: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : defaultValue;
}
