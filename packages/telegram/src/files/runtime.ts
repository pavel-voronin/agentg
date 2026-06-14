import type { EventBus } from '@agentg/framework';
import type { file } from 'tdlib-types';
import type { UpdateByType } from '../tdlib/value.js';

import type { Database } from '../database/client.js';
import { priorities } from '../tdlib/priority.js';
import type { Tdlib } from '../tdlib/index.js';
import type { FilePolicyDecision } from './policy.js';
import type { MediaDownloadPolicyRule } from './policyRules.js';
import type { FileRef } from './types.js';

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
  staleCheckMs?: number;
  tdlib: Tdlib;
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

export type NotificationGroup = UpdateByType<'updateActiveNotifications'>['groups'][number];
export type Notification = UpdateByType<'updateNotification'>['notification'];
export type QuickReplyMessage =
  UpdateByType<'updateQuickReplyShortcut'>['shortcut']['first_message'];
export type StickerSet = UpdateByType<'updateStickerSet'>['sticker_set'];
export type Story = UpdateByType<'updateStory'>['story'];
export type TrendingStickerSets = UpdateByType<'updateTrendingStickerSets'>['sticker_sets'];
export type UserFullInfo = UpdateByType<'updateUserFullInfo'>['user_full_info'];
export type ChatBackground = NonNullable<UpdateByType<'updateChatBackground'>['background']>;
export type ChatPhotoInfo = NonNullable<UpdateByType<'updateChatPhoto'>['photo']>;
export type ChatTheme = NonNullable<UpdateByType<'updateChatTheme'>['theme']>;
export type DefaultBackground = NonNullable<UpdateByType<'updateDefaultBackground'>['background']>;
export type EmojiChatTheme = UpdateByType<'updateEmojiChatThemes'>['chat_themes'][number];
export type FileGenerationStartUpdate = UpdateByType<'updateFileGenerationStart'>;

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

export function shouldDeferFileDownloads(tdlib: Tdlib): boolean {
  const stats = tdlib.getQueueStats();
  return stats.runningCount >= 4 || (stats.highestPendingPriority ?? 0) >= priorities.maximum;
}

export function completedFileAssetFromTdlibFile(
  file: file | undefined
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
