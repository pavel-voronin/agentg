import { rm } from 'node:fs/promises';

import type { chat, message, updateFile, updateMessageContent } from 'tdlib-types';

import { tdJsonObject } from '../tdlib/value.js';
import { publishAssetOwnersAndQueue } from './events.js';
import { runFileGeneration } from './generation.js';
import {
  deleteStoryFileSlots as deleteStorySlots,
  handleFileSnapshot,
  recordFileSlotUpdate
} from './persistence.js';
import type { MediaDownloadPolicyCause } from './policy.js';
import { readFileQueueStats } from './read.js';
import { requestFileSlot } from './request.js';
import {
  DEFAULT_WORKER_FAILURE_BACKOFF_MS,
  DEFAULT_WORKER_INTERVAL_MS,
  DEFAULT_WORKER_MAX_CONCURRENT_DOWNLOADS,
  DEFAULT_WORKER_MAX_FILES_PER_TICK,
  completedFileAssetFromTdlibFile,
  isUnderNavigationPressure,
  positiveInteger,
  type ActiveFileGeneration,
  type ChatBackground,
  type ChatPhotoInfo,
  type ChatTheme,
  type CompletedFileAsset,
  type DefaultBackground,
  type EmojiChatTheme,
  type FileDownloadBatchResult,
  type FileGenerationStartUpdate,
  type FileRequestResult,
  type FileSubsystemOptions,
  type Notification,
  type NotificationGroup,
  type QuickReplyMessage,
  type StickerSet,
  type Story,
  type TrendingStickerSets,
  type UserFullInfo
} from './runtime.js';
import { logWorkerError, processCompletedFileBatch, processQueuedFileBatch } from './queue.js';
import type { FileOwner } from './types.js';

// TODO(file-size): Split public facade, record methods, generation, and worker lifecycle.
export type FileSubsystem = {
  getQueueStats(): ReturnType<typeof readFileQueueStats>;
  handleUpdateFile(update: updateFile): Promise<void>;
  startFileGeneration(update: FileGenerationStartUpdate): void;
  stopFileGeneration(generationId: number | string): Promise<void>;
  recordChatBackgroundFiles(
    chatId: string,
    background: ChatBackground,
    cause: MediaDownloadPolicyCause
  ): Promise<void>;
  recordChatFiles(chat: chat, cause: MediaDownloadPolicyCause): Promise<void>;
  recordChatPhotoFiles(
    chatId: string,
    photo: ChatPhotoInfo | null,
    cause: MediaDownloadPolicyCause
  ): Promise<void>;
  recordChatThemeFiles(
    chatId: string,
    theme: ChatTheme | null,
    cause: MediaDownloadPolicyCause
  ): Promise<void>;
  recordDefaultBackgroundFiles(
    key: string,
    background: DefaultBackground | null,
    cause: MediaDownloadPolicyCause
  ): Promise<void>;
  recordEmojiChatThemeFiles(
    themes: EmojiChatTheme[],
    cause: MediaDownloadPolicyCause
  ): Promise<void>;
  recordMessageContentFiles(
    update: updateMessageContent,
    cause: MediaDownloadPolicyCause
  ): Promise<void>;
  recordMessageFiles(message: message, cause: MediaDownloadPolicyCause): Promise<void>;
  recordNotificationGroupFiles(
    groups: NotificationGroup[],
    cause: MediaDownloadPolicyCause
  ): Promise<void>;
  recordActiveNotificationSnapshotFiles(
    groups: NotificationGroup[],
    cause: MediaDownloadPolicyCause
  ): Promise<void>;
  recordNotificationFiles(
    groupId: number,
    notification: Notification,
    cause: MediaDownloadPolicyCause
  ): Promise<void>;
  recordQuickReplyMessageFiles(
    message: QuickReplyMessage,
    cause: MediaDownloadPolicyCause
  ): Promise<void>;
  recordStickerSetFiles(stickerSet: StickerSet, cause: MediaDownloadPolicyCause): Promise<void>;
  recordStoryFiles(story: Story, cause: MediaDownloadPolicyCause): Promise<void>;
  recordTrendingStickerSetFiles(
    stickerSets: TrendingStickerSets,
    cause: MediaDownloadPolicyCause
  ): Promise<void>;
  recordUserFullInfoFiles(
    userId: string,
    info: UserFullInfo,
    cause: MediaDownloadPolicyCause
  ): Promise<void>;
  deleteStoryFileSlots(input: { posterChatId: string; storyId: number }): Promise<void>;
  requestFile(input: { owner: FileOwner; slotKey: string }): Promise<FileRequestResult>;
};

type FileSubsystemRuntime = {
  files: FileSubsystem;
  start(): Promise<() => undefined>;
};

export function useFiles(options: FileSubsystemOptions): FileSubsystemRuntime {
  const completedFiles = new Map<string, CompletedFileAsset>();
  const activeFileGenerations = new Map<string, ActiveFileGeneration>();
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
  let closed = false;
  let pending = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

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

  const handleTickResult = (result: FileDownloadBatchResult): void => {
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

  const tick = async (): Promise<FileDownloadBatchResult> => {
    const canonicalized = await processCompletedFileBatch(options, completedFiles, maxFilesPerTick);
    if (isUnderNavigationPressure(options.tdlib)) {
      return canonicalized;
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

  function close(): undefined {
    closed = true;
    pending = false;
    completedFiles.clear();
    for (const generation of activeFileGenerations.values()) {
      generation.controller.abort();
    }
    activeFileGenerations.clear();
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    return undefined;
  }

  const files: FileSubsystem = {
    getQueueStats() {
      return readFileQueueStats(options.database);
    },
    async handleUpdateFile(update): Promise<void> {
      const changedAssets = await handleFileSnapshot(options.database, update.file);
      const completedFile = completedFileAssetFromTdlibFile(update.file);
      if (completedFile !== null) {
        for (const assetKey of changedAssets) {
          completedFiles.set(assetKey, {
            ...completedFile,
            assetKey
          });
        }
        if (changedAssets.length > 0) {
          schedule(0);
        }
      }
      await publishAssetOwnersAndQueue(options, changedAssets);
    },
    startFileGeneration(update): void {
      const generationId = update.generation_id;
      activeFileGenerations.get(generationId)?.controller.abort();

      const generation: ActiveFileGeneration = {
        controller: new AbortController(),
        destinationPath: update.destination_path
      };
      activeFileGenerations.set(generationId, generation);

      void runFileGeneration(options, update, generation.controller.signal)
        .catch((error: unknown) => {
          if (generation.controller.signal.aborted) {
            return;
          }
          console.error(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              event: 'telegram.file_generation_unhandled_failure',
              generationId: update.generation_id
            })
          );
        })
        .finally(() => {
          if (activeFileGenerations.get(generationId) === generation) {
            activeFileGenerations.delete(generationId);
          }
        });
    },
    async stopFileGeneration(generationId): Promise<void> {
      const active = activeFileGenerations.get(String(generationId));
      if (active === undefined) {
        return;
      }

      active.controller.abort();
      activeFileGenerations.delete(String(generationId));
      await rm(active.destinationPath, { force: true });
    },
    async recordChatFiles(chat, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          chat: {
            chat: tdJsonObject(chat),
            id: String(chat.id)
          }
        },
        cause
      );
    },
    async recordChatBackgroundFiles(chatId, background, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          chatBackground: {
            background: tdJsonObject(background),
            chatId
          }
        },
        cause,
        {
          slotKeyPrefix: 'background.'
        }
      );
    },
    async recordChatPhotoFiles(chatId, photo, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          chatPhoto: {
            chatId,
            photo: photo === null ? null : tdJsonObject(photo)
          }
        },
        cause,
        {
          slotKeyPrefix: 'avatar.'
        }
      );
    },
    async recordChatThemeFiles(chatId, theme, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          chatTheme: {
            chatId,
            theme: theme === null ? null : tdJsonObject(theme)
          }
        },
        cause,
        {
          slotKeyPrefix: 'theme.'
        }
      );
    },
    async recordDefaultBackgroundFiles(key, background, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          defaultBackground: {
            background: background === null ? null : tdJsonObject(background),
            key
          }
        },
        cause,
        {
          slotKeyPrefix: 'background.'
        }
      );
    },
    async recordEmojiChatThemeFiles(themes, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          emojiChatThemes: {
            themes: themes.map(tdJsonObject)
          }
        },
        cause
      );
    },
    async recordMessageContentFiles(update, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          contentUpdate: {
            chatId: String(update.chat_id),
            content: tdJsonObject(update.new_content),
            messageId: String(update.message_id)
          }
        },
        cause
      );
    },
    async recordMessageFiles(message, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          message: {
            chatId: String(message.chat_id),
            content: tdJsonObject(message.content),
            messageId: String(message.id)
          }
        },
        cause
      );
    },
    async recordNotificationGroupFiles(groups, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          notificationGroups: {
            groups: groups.map(tdJsonObject)
          }
        },
        cause
      );
    },
    async recordActiveNotificationSnapshotFiles(groups, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          notificationGroups: {
            groups: groups.map(tdJsonObject)
          }
        },
        cause,
        undefined,
        {
          pruneStaleActiveNotificationSlots: true
        }
      );
    },
    async recordNotificationFiles(groupId, notification, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          notificationGroups: {
            groups: [
              {
                id: groupId,
                notifications: [tdJsonObject(notification)]
              }
            ]
          }
        },
        cause
      );
    },
    async recordQuickReplyMessageFiles(message, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          quickReplyMessage: {
            content: tdJsonObject(message.content),
            messageId: String(message.id)
          }
        },
        cause
      );
    },
    async recordStickerSetFiles(stickerSet, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          stickerSet: {
            id: stickerSet.id,
            stickerSet: tdJsonObject(stickerSet)
          }
        },
        cause
      );
    },
    async recordStoryFiles(story, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          story: {
            posterChatId: String(story.poster_chat_id),
            story: tdJsonObject(story),
            storyId: story.id
          }
        },
        cause
      );
    },
    async recordTrendingStickerSetFiles(stickerSets, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          stickerSetInfos: {
            sets: stickerSets.sets.map(tdJsonObject)
          }
        },
        cause,
        {
          slotKeyPrefix: 'trending.'
        }
      );
    },
    async recordUserFullInfoFiles(userId, info, cause): Promise<void> {
      await recordFileSlotUpdate(
        options,
        {
          userFullInfo: {
            info: tdJsonObject(info),
            userId
          }
        },
        cause,
        {
          slotKeyPrefix: 'full_info.'
        }
      );
    },
    async deleteStoryFileSlots(input): Promise<void> {
      await deleteStorySlots(options.database, input);
    },
    async requestFile(input): Promise<FileRequestResult> {
      return requestFileSlot(options, input);
    }
  };

  return {
    files,
    start(): Promise<() => undefined> {
      runTick();
      return Promise.resolve(close);
    }
  };
}
