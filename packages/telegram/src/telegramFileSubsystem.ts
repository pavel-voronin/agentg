import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { EventBus } from '@agentg/events/bus';
import { createIntegrationEvent } from '@agentg/events/envelope';
import { and, eq, notInArray, sql } from 'drizzle-orm';

import type { TelegramDatabase } from './database.js';
import {
  createTelegramDefaultBackgroundUpdatedEvent,
  createTelegramChatUpdatedEvent,
  createTelegramFileQueueUpdatedEvent,
  createTelegramReadMessageUpdatedEvent
} from './integrationEvents.js';
import {
  TELEGRAM_ACTIVE_NOTIFICATION_MODEL,
  TELEGRAM_CHAT_MODEL,
  TELEGRAM_DEFAULT_BACKGROUND_MODEL,
  TELEGRAM_EMOJI_CHAT_THEMES_MODEL,
  TELEGRAM_MESSAGE_MODEL,
  TELEGRAM_QUICK_REPLY_MESSAGE_MODEL,
  TELEGRAM_STICKER_SET_MODEL,
  TELEGRAM_STORY_MODEL,
  TELEGRAM_USER_MODEL,
  telegramActiveNotificationRef,
  telegramEmojiChatThemesRef,
  telegramMessageModelParts,
  telegramMessageRef,
  telegramQuickReplyMessageRef,
  telegramStickerSetRef,
  telegramStoryRef,
  telegramUserRef
} from './modelRefs.js';
import {
  telegramFileAssets,
  telegramFileDownloadJobs,
  telegramFileSlots,
  telegramMessages,
  telegramTdlibFiles
} from './schema.js';
import {
  telegramWireFileOrUndefined,
  telegramWireJsonObject,
  type TelegramWireChat,
  type TelegramWireFile,
  type TelegramWireFileUpdate,
  type TelegramWireMessage,
  type TelegramWireMessageContentUpdate,
  type TelegramWireUpdateByType
} from './telegramWire.js';
import { extractTelegramFileSlots, type TelegramFileSlotUpdate } from './telegramFileExtractor.js';
import {
  ownerKey,
  readTelegramFileOwnersForAssets,
  readTelegramFileQueueStats,
  readTelegramFileRef
} from './telegramFileRead.js';
import {
  decideTelegramFilePolicy,
  type TelegramFilePolicyDecision,
  type TelegramMediaDownloadPolicyCause
} from './telegramFilePolicy.js';
import type {
  ExtractedTelegramFileSlot,
  TelegramFileOwner,
  TelegramFileOwnerKey,
  TelegramFileRef
} from './telegramFileTypes.js';
import { invokeTdlibWithEvents, type TdlibInvoker } from './telegramOperationEvents.js';
import { telegramTdlibPriorities, assertTelegramTdlibPriority } from './telegramTdlibPriority.js';
import { isTelegramTdlibUnderNavigationPressure } from './telegramTdlibScheduler.js';
import { chatDirectoryEntryByChatId } from './control-plane/backend/chatDirectory.js';
import { readMessageSelection, toReadMessages } from './telegram-read-model/message.js';
import { readDefaultBackgroundSelection } from './telegram-store/defaultBackground.js';

export type TelegramFileSubsystem = {
  close(): void;
  getQueueStats(): ReturnType<typeof readTelegramFileQueueStats>;
  handleUpdateFile(update: TelegramWireFileUpdate): Promise<void>;
  startFileGeneration(update: TelegramWireFileGenerationStartUpdate): void;
  stopFileGeneration(generationId: number | string): Promise<void>;
  recordChatBackgroundFiles(
    chatId: string,
    background: TelegramWireChatBackground,
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordChatFiles(chat: TelegramWireChat, cause: TelegramMediaDownloadPolicyCause): Promise<void>;
  recordChatPhotoFiles(
    chatId: string,
    photo: TelegramWireChatPhotoInfo | null,
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordChatThemeFiles(
    chatId: string,
    theme: TelegramWireChatTheme | null,
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordDefaultBackgroundFiles(
    key: string,
    background: TelegramWireDefaultBackground | null,
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordEmojiChatThemeFiles(
    themes: TelegramWireEmojiChatTheme[],
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordMessageContentFiles(
    update: TelegramWireMessageContentUpdate,
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordMessageFiles(
    message: TelegramWireMessage,
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordNotificationGroupFiles(
    groups: TelegramWireNotificationGroup[],
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordNotificationFiles(
    groupId: number,
    notification: TelegramWireNotification,
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordQuickReplyMessageFiles(
    message: TelegramWireQuickReplyMessage,
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordStickerSetFiles(
    stickerSet: TelegramWireStickerSet,
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordStoryFiles(
    story: TelegramWireStory,
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordTrendingStickerSetFiles(
    stickerSets: TelegramWireTrendingStickerSets,
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  recordUserFullInfoFiles(
    userId: string,
    info: TelegramWireUserFullInfo,
    cause: TelegramMediaDownloadPolicyCause
  ): Promise<void>;
  deleteStoryFileSlots(input: { posterChatId: string; storyId: number }): Promise<void>;
  requestFile(input: {
    owner: TelegramFileOwner;
    slotKey: string;
  }): Promise<TelegramFileRequestResult>;
};

export type TelegramFileSubsystemOptions = {
  client: TdlibInvoker;
  database: TelegramDatabase;
  eventBus: EventBus;
  failureBackoffMs?: number;
  filesDirectory: string;
  intervalMs?: number;
  maxConcurrentDownloads?: number;
  maxFilesPerTick?: number;
};

export type TelegramFileRequestResult = {
  decision: TelegramFilePolicyDecision;
  file: TelegramFileRef | null;
};

export type TelegramFileDownloadRow = {
  assetKey: string;
  byteSize: number | null;
  fileName: string | null;
  latestTdlibFileId: number | null;
  mimeType: string | null;
  priority: number;
  transport: TelegramFileDownloadTransport;
};

type TelegramFileDownloadTransport =
  | {
      chatId: number;
      kind: 'message';
      messageId: number;
    }
  | {
      kind: 'file';
    };

type TelegramFileDownloadResult = {
  assetKey: string;
  failed: boolean;
  ready: boolean;
};

type TelegramFileDownloadBatchResult = {
  failedCount: number;
  processedCount: number;
  readyCount: number;
};

type TelegramWireNotificationGroup =
  TelegramWireUpdateByType<'updateActiveNotifications'>['groups'][number];
type TelegramWireNotification = TelegramWireUpdateByType<'updateNotification'>['notification'];
type TelegramWireQuickReplyMessage =
  TelegramWireUpdateByType<'updateQuickReplyShortcut'>['shortcut']['first_message'];
type TelegramWireStickerSet = TelegramWireUpdateByType<'updateStickerSet'>['sticker_set'];
type TelegramWireStory = TelegramWireUpdateByType<'updateStory'>['story'];
type TelegramWireTrendingStickerSets =
  TelegramWireUpdateByType<'updateTrendingStickerSets'>['sticker_sets'];
type TelegramWireUserFullInfo = TelegramWireUpdateByType<'updateUserFullInfo'>['user_full_info'];
type TelegramWireChatBackground = NonNullable<
  TelegramWireUpdateByType<'updateChatBackground'>['background']
>;
type TelegramWireChatPhotoInfo = NonNullable<TelegramWireUpdateByType<'updateChatPhoto'>['photo']>;
type TelegramWireChatTheme = NonNullable<TelegramWireUpdateByType<'updateChatTheme'>['theme']>;
type TelegramWireDefaultBackground = NonNullable<
  TelegramWireUpdateByType<'updateDefaultBackground'>['background']
>;
type TelegramWireEmojiChatTheme =
  TelegramWireUpdateByType<'updateEmojiChatThemes'>['chat_themes'][number];
type TelegramWireFileGenerationStartUpdate = TelegramWireUpdateByType<'updateFileGenerationStart'>;

type TelegramCompletedFileAsset = {
  assetKey: string;
  localPath: string;
  tdlibFileId: number;
};

type ActiveTelegramFileGeneration = {
  controller: AbortController;
  destinationPath: string;
};

type StoredCanonicalFile = {
  byteSize: number;
  relativePath: string;
  sha256: string;
};

type TelegramFileAssetStatus = 'failed' | 'known' | 'ready';

type RequestFileSlotRow = {
  assetKey: string;
  assetStatus: string;
  byteSize: number | null;
  jobStatus: string | null;
  mediaKind: string;
};

type TelegramFileSlotScope = {
  slotKeyPrefix: string;
};

const DEFAULT_WORKER_INTERVAL_MS = 1000;
const DEFAULT_WORKER_FAILURE_BACKOFF_MS = 5000;
const DEFAULT_WORKER_MAX_CONCURRENT_DOWNLOADS = 2;
const DEFAULT_WORKER_MAX_FILES_PER_TICK = 4;
const DOWNLOAD_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;
const CANONICAL_FILES_DIR = 'agentg-media';

export function createTelegramFileSubsystem(
  options: TelegramFileSubsystemOptions
): TelegramFileSubsystem {
  const completedFiles = new Map<string, TelegramCompletedFileAsset>();
  const activeFileGenerations = new Map<string, ActiveTelegramFileGeneration>();
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

  runTick();

  return {
    close(): void {
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
    },
    getQueueStats() {
      return readTelegramFileQueueStats(options.database);
    },
    async handleUpdateFile(update): Promise<void> {
      const changedAssets = await handleTdlibFileSnapshot(options.database, update.file);
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

      const generation: ActiveTelegramFileGeneration = {
        controller: new AbortController(),
        destinationPath: update.destination_path
      };
      activeFileGenerations.set(generationId, generation);

      void startTelegramFileGeneration(options, update, generation.controller.signal)
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
            chat: telegramWireJsonObject(chat),
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
            background: telegramWireJsonObject(background),
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
            photo: photo === null ? null : telegramWireJsonObject(photo)
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
            theme: theme === null ? null : telegramWireJsonObject(theme)
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
            background: background === null ? null : telegramWireJsonObject(background),
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
            themes: themes.map(telegramWireJsonObject)
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
            content: telegramWireJsonObject(update.new_content),
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
            content: telegramWireJsonObject(message.content),
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
            groups: groups.map(telegramWireJsonObject)
          }
        },
        cause
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
                notifications: [telegramWireJsonObject(notification)]
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
            content: telegramWireJsonObject(message.content),
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
            stickerSet: telegramWireJsonObject(stickerSet)
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
            story: telegramWireJsonObject(story),
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
            sets: stickerSets.sets.map(telegramWireJsonObject)
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
            info: telegramWireJsonObject(info),
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
      const owner = telegramStoryRef(input);
      await options.database
        .delete(telegramFileSlots)
        .where(
          and(
            eq(telegramFileSlots.ownerModel, owner._model),
            eq(telegramFileSlots.ownerId, owner.id)
          )
        );
    },
    async requestFile(input): Promise<TelegramFileRequestResult> {
      return requestTelegramFile(options, input);
    }
  };
}

async function recordFileSlotUpdate(
  options: TelegramFileSubsystemOptions,
  update: TelegramFileSlotUpdate,
  cause: TelegramMediaDownloadPolicyCause,
  scope?: TelegramFileSlotScope
): Promise<void> {
  const slots = extractTelegramFileSlots(update);
  const owners = updateFileOwners(update);
  const changedOwners = new Map<string, TelegramFileOwnerKey>();
  let queueChanged = false;

  if (update.notificationGroups !== undefined) {
    await deleteStaleActiveNotificationFileSlots(options.database, owners);
  }

  for (const owner of owners) {
    const ownerSlots = slots.filter(
      (slot) => slot.owner._model === owner.ownerModel && slot.owner.id === owner.ownerId
    );
    const result =
      scope === undefined
        ? await replaceOwnerFileSlots(options.database, owner, ownerSlots, cause)
        : await replaceOwnerFileSlotsInScope(options.database, owner, ownerSlots, cause, scope);
    if (result.ownerChanged) {
      changedOwners.set(ownerKey(owner), owner);
    }
    queueChanged ||= result.queueChanged;
  }

  for (const owner of changedOwners.values()) {
    await publishTelegramFileOwnerUpdated(options, owner);
  }
  if (queueChanged || changedOwners.size > 0) {
    await publishTelegramFileQueueUpdated(options);
  }
}

function updateFileOwners(update: TelegramFileSlotUpdate): TelegramFileOwnerKey[] {
  return [
    ...(update.chat === undefined
      ? []
      : [
          {
            ownerId: update.chat.id,
            ownerModel: TELEGRAM_CHAT_MODEL
          }
        ]),
    ...(update.chatBackground === undefined
      ? []
      : [
          {
            ownerId: update.chatBackground.chatId,
            ownerModel: TELEGRAM_CHAT_MODEL
          }
        ]),
    ...(update.chatPhoto === undefined
      ? []
      : [
          {
            ownerId: update.chatPhoto.chatId,
            ownerModel: TELEGRAM_CHAT_MODEL
          }
        ]),
    ...(update.chatTheme === undefined
      ? []
      : [
          {
            ownerId: update.chatTheme.chatId,
            ownerModel: TELEGRAM_CHAT_MODEL
          }
        ]),
    ...(update.defaultBackground === undefined
      ? []
      : [
          {
            ownerId: update.defaultBackground.key,
            ownerModel: TELEGRAM_DEFAULT_BACKGROUND_MODEL
          }
        ]),
    ...(update.emojiChatThemes === undefined
      ? []
      : [
          {
            ownerId: telegramEmojiChatThemesRef().id,
            ownerModel: TELEGRAM_EMOJI_CHAT_THEMES_MODEL
          }
        ]),
    ...(update.message === undefined
      ? []
      : [
          {
            ownerId: telegramMessageRef({
              chatId: update.message.chatId,
              messageId: update.message.messageId
            }).id,
            ownerModel: TELEGRAM_MESSAGE_MODEL
          }
        ]),
    ...(update.contentUpdate === undefined
      ? []
      : [
          {
            ownerId: telegramMessageRef({
              chatId: update.contentUpdate.chatId,
              messageId: update.contentUpdate.messageId
            }).id,
            ownerModel: TELEGRAM_MESSAGE_MODEL
          }
        ]),
    ...(update.notificationGroups === undefined
      ? []
      : notificationGroupFileOwners(update.notificationGroups.groups)),
    ...(update.quickReplyMessage === undefined
      ? []
      : [
          {
            ownerId: telegramQuickReplyMessageRef(update.quickReplyMessage.messageId).id,
            ownerModel: TELEGRAM_QUICK_REPLY_MESSAGE_MODEL
          }
        ]),
    ...(update.stickerSet === undefined
      ? []
      : [
          {
            ownerId: telegramStickerSetRef(update.stickerSet.id).id,
            ownerModel: TELEGRAM_STICKER_SET_MODEL
          }
        ]),
    ...(update.stickerSetInfos === undefined
      ? []
      : update.stickerSetInfos.sets
          .map((stickerSet) => safeTdlibId(stickerSet.id))
          .filter((stickerSetId): stickerSetId is string => stickerSetId !== null)
          .map((stickerSetId) => ({
            ownerId: telegramStickerSetRef(stickerSetId).id,
            ownerModel: TELEGRAM_STICKER_SET_MODEL
          }))),
    ...(update.story === undefined
      ? []
      : [
          {
            ownerId: telegramStoryRef({
              posterChatId: update.story.posterChatId,
              storyId: update.story.storyId
            }).id,
            ownerModel: TELEGRAM_STORY_MODEL
          }
        ]),
    ...(update.userFullInfo === undefined
      ? []
      : [
          {
            ownerId: telegramUserRef(update.userFullInfo.userId).id,
            ownerModel: TELEGRAM_USER_MODEL
          }
        ])
  ];
}

function notificationGroupFileOwners(groups: Record<string, unknown>[]): TelegramFileOwnerKey[] {
  const owners: TelegramFileOwnerKey[] = [];

  for (const group of groups) {
    const groupId = safeTdlibId(group.id);
    for (const notification of asRecordArray(group.notifications)) {
      const type = asPlainRecord(notification.type);
      if (type?._ === 'notificationTypeNewMessage') {
        const message = asPlainRecord(type.message);
        const chatId = safeTdlibId(message?.chat_id);
        const messageId = safeTdlibId(message?.id);
        if (chatId !== null && messageId !== null) {
          owners.push({
            ownerId: telegramMessageRef({ chatId, messageId }).id,
            ownerModel: TELEGRAM_MESSAGE_MODEL
          });
        }
      }

      if (type?._ === 'notificationTypeNewPushMessage') {
        const notificationId = safeTdlibId(notification.id);
        if (groupId !== null && notificationId !== null) {
          owners.push({
            ownerId: telegramActiveNotificationRef({ groupId, notificationId }).id,
            ownerModel: TELEGRAM_ACTIVE_NOTIFICATION_MODEL
          });
        }
      }
    }
  }

  return owners;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asPlainRecord).filter(isDefined) : [];
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeTdlibId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : null;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

async function deleteStaleActiveNotificationFileSlots(
  database: TelegramDatabase,
  owners: TelegramFileOwnerKey[]
): Promise<void> {
  const ownerIds = [
    ...new Set(
      owners
        .filter((owner) => owner.ownerModel === TELEGRAM_ACTIVE_NOTIFICATION_MODEL)
        .map((owner) => owner.ownerId)
    )
  ];

  if (ownerIds.length === 0) {
    await database
      .delete(telegramFileSlots)
      .where(eq(telegramFileSlots.ownerModel, TELEGRAM_ACTIVE_NOTIFICATION_MODEL));
    return;
  }

  await database
    .delete(telegramFileSlots)
    .where(
      and(
        eq(telegramFileSlots.ownerModel, TELEGRAM_ACTIVE_NOTIFICATION_MODEL),
        notInArray(telegramFileSlots.ownerId, ownerIds)
      )
    );
}

async function replaceOwnerFileSlots(
  database: TelegramDatabase,
  owner: TelegramFileOwnerKey,
  slots: ExtractedTelegramFileSlot[],
  cause: TelegramMediaDownloadPolicyCause
): Promise<{ ownerChanged: boolean; queueChanged: boolean }> {
  const currentRows = await database
    .select({
      slotKey: telegramFileSlots.slotKey
    })
    .from(telegramFileSlots)
    .where(
      and(
        eq(telegramFileSlots.ownerModel, owner.ownerModel),
        eq(telegramFileSlots.ownerId, owner.ownerId)
      )
    );

  if (slots.length === 0) {
    const removed = await database
      .delete(telegramFileSlots)
      .where(
        and(
          eq(telegramFileSlots.ownerModel, owner.ownerModel),
          eq(telegramFileSlots.ownerId, owner.ownerId)
        )
      )
      .returning({
        slotKey: telegramFileSlots.slotKey
      });
    return {
      ownerChanged: removed.length > 0,
      queueChanged: false
    };
  }

  const slotKeys = slots.map((slot) => slot.slotKey);
  const removed = await database
    .delete(telegramFileSlots)
    .where(
      and(
        eq(telegramFileSlots.ownerModel, owner.ownerModel),
        eq(telegramFileSlots.ownerId, owner.ownerId),
        notInArray(telegramFileSlots.slotKey, slotKeys)
      )
    )
    .returning({
      slotKey: telegramFileSlots.slotKey
    });
  const currentSlotKeys = new Set(currentRows.map((row) => row.slotKey));
  let ownerChanged = removed.length > 0;
  let queueChanged = false;

  for (const slot of slots) {
    const changedSlot = await upsertExtractedSlot(database, slot, cause);
    ownerChanged ||= changedSlot.ownerChanged || !currentSlotKeys.has(slot.slotKey);
    queueChanged ||= changedSlot.queueChanged;
  }

  return { ownerChanged, queueChanged };
}

async function replaceOwnerFileSlotsInScope(
  database: TelegramDatabase,
  owner: TelegramFileOwnerKey,
  slots: ExtractedTelegramFileSlot[],
  cause: TelegramMediaDownloadPolicyCause,
  scope: TelegramFileSlotScope
): Promise<{ ownerChanged: boolean; queueChanged: boolean }> {
  const scopedSlotCondition = sql`${telegramFileSlots.slotKey} like ${`${scope.slotKeyPrefix}%`}`;
  const currentRows = await database
    .select({
      slotKey: telegramFileSlots.slotKey
    })
    .from(telegramFileSlots)
    .where(
      and(
        eq(telegramFileSlots.ownerModel, owner.ownerModel),
        eq(telegramFileSlots.ownerId, owner.ownerId),
        scopedSlotCondition
      )
    );

  if (slots.length === 0) {
    const removed = await database
      .delete(telegramFileSlots)
      .where(
        and(
          eq(telegramFileSlots.ownerModel, owner.ownerModel),
          eq(telegramFileSlots.ownerId, owner.ownerId),
          scopedSlotCondition
        )
      )
      .returning({
        slotKey: telegramFileSlots.slotKey
      });
    return {
      ownerChanged: removed.length > 0,
      queueChanged: false
    };
  }

  const slotKeys = slots.map((slot) => slot.slotKey);
  const removed = await database
    .delete(telegramFileSlots)
    .where(
      and(
        eq(telegramFileSlots.ownerModel, owner.ownerModel),
        eq(telegramFileSlots.ownerId, owner.ownerId),
        scopedSlotCondition,
        notInArray(telegramFileSlots.slotKey, slotKeys)
      )
    )
    .returning({
      slotKey: telegramFileSlots.slotKey
    });
  const currentSlotKeys = new Set(currentRows.map((row) => row.slotKey));
  let ownerChanged = removed.length > 0;
  let queueChanged = false;

  for (const slot of slots) {
    const changedSlot = await upsertExtractedSlot(database, slot, cause);
    ownerChanged ||= changedSlot.ownerChanged || !currentSlotKeys.has(slot.slotKey);
    queueChanged ||= changedSlot.queueChanged;
  }

  return { ownerChanged, queueChanged };
}

async function upsertExtractedSlot(
  database: TelegramDatabase,
  slot: ExtractedTelegramFileSlot,
  cause: TelegramMediaDownloadPolicyCause
): Promise<{ ownerChanged: boolean; queueChanged: boolean }> {
  await upsertTdlibFile(database, slot.file);
  const assetKey = telegramFileAssetKey(slot.file);
  const asset = await upsertTelegramFileAsset(database, slot, assetKey);
  const decision = decideTelegramFilePolicy({
    cause,
    current: {
      sourceFingerprint: assetKey,
      status: asset.status
    },
    slot,
    sourceFingerprint: assetKey
  });
  let queueChanged = false;

  if (decision.action === 'enqueue' && asset.status !== 'ready') {
    queueChanged = await enqueueTelegramFileAssetDownload(
      database,
      assetKey,
      downloadPriorityForCause(cause)
    );
  }

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
      target: [telegramFileSlots.ownerModel, telegramFileSlots.ownerId, telegramFileSlots.slotKey]
    })
    .returning({
      slotKey: telegramFileSlots.slotKey
    });

  return {
    ownerChanged: upserted.length === 1,
    queueChanged
  };
}

async function upsertTdlibFile(database: TelegramDatabase, file: TelegramWireFile): Promise<void> {
  await database
    .insert(telegramTdlibFiles)
    .values(tdlibFileRow(file))
    .onConflictDoUpdate({
      set: {
        ...tdlibFileRow(file),
        updatedAt: sql`now()`
      },
      target: telegramTdlibFiles.tdlibFileId
    });
}

function tdlibFileRow(file: TelegramWireFile): typeof telegramTdlibFiles.$inferInsert {
  return {
    expectedSize: nullablePositive(file.expected_size),
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

async function upsertTelegramFileAsset(
  database: TelegramDatabase,
  slot: ExtractedTelegramFileSlot,
  assetKey: string
): Promise<{ assetKey: string; status: TelegramFileAssetStatus }> {
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
      target: telegramFileAssets.assetKey
    })
    .returning({
      assetKey: telegramFileAssets.assetKey,
      status: telegramFileAssets.status
    });

  if (asset === undefined) {
    throw new Error(`Telegram file asset was not upserted: ${assetKey}`);
  }

  return {
    assetKey: asset.assetKey,
    status: assertAssetStatus(asset.status)
  };
}

async function enqueueTelegramFileAssetDownload(
  database: TelegramDatabase,
  assetKey: string,
  priority: number
): Promise<boolean> {
  await database
    .insert(telegramFileDownloadJobs)
    .values({
      assetKey,
      priority,
      status: 'queued'
    })
    .onConflictDoUpdate({
      set: {
        claimedAt: sql`case when ${telegramFileDownloadJobs.status} in (${'queued'}, ${'downloading'}) then ${telegramFileDownloadJobs.claimedAt} else null end`,
        lastError: sql`case when ${telegramFileDownloadJobs.status} in (${'queued'}, ${'downloading'}) then ${telegramFileDownloadJobs.lastError} else null end`,
        priority: sql`greatest(${telegramFileDownloadJobs.priority}, ${priority})`,
        status: sql`case when ${telegramFileDownloadJobs.status} in (${'queued'}, ${'downloading'}) then ${telegramFileDownloadJobs.status} else ${'queued'} end`,
        updatedAt: sql`now()`
      },
      target: telegramFileDownloadJobs.assetKey
    });
  return true;
}

async function handleTdlibFileSnapshot(
  database: TelegramDatabase,
  file: TelegramWireFile
): Promise<string[]> {
  await upsertTdlibFile(database, file);
  const updated = await database
    .update(telegramFileAssets)
    .set({
      downloadedByteSize: file.local.downloaded_size,
      updatedAt: sql`now()`
    })
    .where(
      and(
        eq(telegramFileAssets.latestTdlibFileId, file.id),
        sql`${telegramFileAssets.status} <> 'ready'`
      )
    )
    .returning({
      assetKey: telegramFileAssets.assetKey
    });

  return updated.map((asset) => asset.assetKey);
}

async function requestTelegramFile(
  options: TelegramFileSubsystemOptions,
  input: { owner: TelegramFileOwner; slotKey: string }
): Promise<TelegramFileRequestResult> {
  const row = await readRequestFileSlotRow(options.database, input.owner, input.slotKey);
  if (row === null) {
    return {
      decision: {
        action: 'deny',
        reason: 'file slot is not known'
      },
      file: null
    };
  }

  const decision = decideTelegramFilePolicy({
    cause: 'explicit_request',
    current: {
      sourceFingerprint: row.assetKey,
      status: row.jobStatus ?? row.assetStatus
    },
    slot: {
      byteSize: row.byteSize,
      mediaKind: assertMediaKind(row.mediaKind)
    },
    sourceFingerprint: row.assetKey
  });

  if (decision.action === 'enqueue' && row.assetStatus !== 'ready') {
    await enqueueTelegramFileAssetDownload(
      options.database,
      row.assetKey,
      downloadPriorityForCause('explicit_request')
    );
    await publishTelegramFileOwnerUpdated(options, {
      ownerId: input.owner.id,
      ownerModel: input.owner._model
    });
    await publishTelegramFileQueueUpdated(options);
  }

  return {
    decision,
    file: await readTelegramFileRef(options.database, input.owner, input.slotKey)
  };
}

async function readRequestFileSlotRow(
  database: TelegramDatabase,
  owner: TelegramFileOwner,
  slotKey: string
): Promise<RequestFileSlotRow | null> {
  const [row] = await database
    .select({
      assetKey: telegramFileSlots.assetKey,
      assetStatus: telegramFileAssets.status,
      byteSize: telegramFileSlots.byteSize,
      jobStatus: telegramFileDownloadJobs.status,
      mediaKind: telegramFileSlots.mediaKind
    })
    .from(telegramFileSlots)
    .innerJoin(telegramFileAssets, eq(telegramFileAssets.assetKey, telegramFileSlots.assetKey))
    .leftJoin(
      telegramFileDownloadJobs,
      eq(telegramFileDownloadJobs.assetKey, telegramFileSlots.assetKey)
    )
    .where(
      and(
        eq(telegramFileSlots.ownerModel, owner._model),
        eq(telegramFileSlots.ownerId, owner.id),
        eq(telegramFileSlots.slotKey, slotKey)
      )
    )
    .limit(1);

  return row ?? null;
}

async function processQueuedFileBatch(
  options: TelegramFileSubsystemOptions,
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
    return reconciled;
  }

  await publishTelegramFileQueueUpdated(options);
  const results: TelegramFileDownloadResult[] = [];
  for (let index = 0; index < rows.length; index += maxConcurrentDownloads) {
    const batch = rows.slice(index, index + maxConcurrentDownloads);
    results.push(...(await Promise.all(batch.map((row) => processClaimedFile(options, row)))));
  }

  await publishAssetOwnersAndQueue(options, [...new Set(results.map((result) => result.assetKey))]);

  return {
    failedCount: reconciled.failedCount + results.filter((result) => result.failed).length,
    processedCount: reconciled.processedCount + results.length,
    readyCount: reconciled.readyCount + results.filter((result) => result.ready).length
  };
}

async function claimNextQueuedTelegramFileDownload(
  database: TelegramDatabase
): Promise<TelegramFileDownloadRow | null> {
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

  return claimed === undefined ? null : readTelegramFileDownloadRow(database, claimed.assetKey);
}

async function processClaimedFile(
  options: TelegramFileSubsystemOptions,
  row: TelegramFileDownloadRow
): Promise<TelegramFileDownloadResult> {
  try {
    const file = await dispatchTdlibFileDownload(options, row);
    const completedFile = completedFileAssetFromTdlibFile(file);
    if (completedFile !== null) {
      await canonicalizeCompletedTelegramFile(options, {
        ...completedFile,
        assetKey: row.assetKey
      });
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
  options: TelegramFileSubsystemOptions,
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
  await publishAssetOwnersAndQueue(options, [...new Set(results.map((result) => result.assetKey))]);
  return {
    failedCount: results.filter((result) => result.failed).length,
    processedCount: results.length,
    readyCount: results.filter((result) => result.ready).length
  };
}

async function readStaleTelegramFileDownloadRows(
  database: TelegramDatabase,
  staleBefore: Date,
  limit: number
): Promise<TelegramFileDownloadRow[]> {
  const jobs = await database
    .select({
      assetKey: telegramFileDownloadJobs.assetKey
    })
    .from(telegramFileDownloadJobs)
    .where(staleDownloadCondition(staleBefore))
    .orderBy(telegramFileDownloadJobs.updatedAt)
    .limit(limit);

  const rows = await Promise.all(
    jobs.map((job) => readTelegramFileDownloadRow(database, job.assetKey))
  );
  return rows.filter((row): row is TelegramFileDownloadRow => row !== null);
}

async function reconcileStaleFileDownload(
  options: TelegramFileSubsystemOptions,
  row: TelegramFileDownloadRow
): Promise<TelegramFileDownloadResult> {
  try {
    const file = await getTdlibFile(options, row);
    const completedFile = completedFileAssetFromTdlibFile(file);
    if (completedFile !== null) {
      await canonicalizeCompletedTelegramFile(options, {
        ...completedFile,
        assetKey: row.assetKey
      });
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
  options: TelegramFileSubsystemOptions,
  row: TelegramFileDownloadRow
): Promise<TelegramWireFile | undefined> {
  if (row.latestTdlibFileId === null) {
    throw new Error(`Telegram file asset has no TDLib file id: ${row.assetKey}`);
  }

  return telegramWireFileOrUndefined(
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

async function startTelegramFileGeneration(
  options: TelegramFileSubsystemOptions,
  update: TelegramWireFileGenerationStartUpdate,
  signal: AbortSignal
): Promise<void> {
  try {
    if (update.conversion !== '#url#') {
      throw new Error(`Unsupported Telegram file generation conversion: ${update.conversion}`);
    }

    await downloadGeneratedFileFromUrl(options, update, signal);
    if (signal.aborted) {
      return;
    }
    await finishTelegramFileGeneration(options, update.generation_id, null);
  } catch (error) {
    if (signal.aborted) {
      return;
    }
    await finishTelegramFileGeneration(options, update.generation_id, {
      _: 'error',
      code: 500,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

async function downloadGeneratedFileFromUrl(
  options: TelegramFileSubsystemOptions,
  update: TelegramWireFileGenerationStartUpdate,
  signal: AbortSignal
): Promise<void> {
  const url = new URL(update.original_path);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported Telegram generated file URL protocol: ${url.protocol}`);
  }

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Telegram generated file download failed with HTTP ${String(response.status)}`);
  }
  if (response.body === null) {
    throw new Error('Telegram generated file download returned an empty body');
  }

  const expectedSize = response.headers.get('content-length');
  await setTelegramFileGenerationProgress(options, update.generation_id, {
    expectedSize: expectedSize === null ? 0 : Number.parseInt(expectedSize, 10),
    localPrefixSize: 0
  });

  await mkdir(dirname(update.destination_path), { recursive: true });
  const source = Readable.fromWeb(
    response.body as unknown as Parameters<typeof Readable.fromWeb>[0]
  );
  await pipeline(source, createWriteStream(update.destination_path), { signal });

  const generated = await stat(update.destination_path);
  await setTelegramFileGenerationProgress(options, update.generation_id, {
    expectedSize: generated.size,
    localPrefixSize: generated.size
  });
}

async function setTelegramFileGenerationProgress(
  options: TelegramFileSubsystemOptions,
  generationId: number | string,
  input: {
    expectedSize: number;
    localPrefixSize: number;
  }
): Promise<void> {
  await invokeTdlibWithEvents(
    options.eventBus,
    options.client,
    {
      _: 'setFileGenerationProgress',
      expected_size: safeFileGenerationSize(input.expectedSize),
      generation_id: generationId,
      local_prefix_size: safeFileGenerationSize(input.localPrefixSize)
    },
    {
      priority: telegramTdlibPriorities.normal
    }
  );
}

async function finishTelegramFileGeneration(
  options: TelegramFileSubsystemOptions,
  generationId: number | string,
  error: Record<string, unknown> | null
): Promise<void> {
  await invokeTdlibWithEvents(
    options.eventBus,
    options.client,
    {
      _: 'finishFileGeneration',
      error,
      generation_id: generationId
    },
    {
      priority: telegramTdlibPriorities.normal
    }
  );
}

function safeFileGenerationSize(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

async function getTdlibFile(
  options: TelegramFileSubsystemOptions,
  row: TelegramFileDownloadRow
): Promise<TelegramWireFile | undefined> {
  if (row.latestTdlibFileId === null) {
    throw new Error(`Telegram file asset has no TDLib file id: ${row.assetKey}`);
  }
  return telegramWireFileOrUndefined(
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
  options: TelegramFileSubsystemOptions,
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

async function canonicalizeCompletedTelegramFile(
  options: TelegramFileSubsystemOptions,
  file: TelegramCompletedFileAsset
): Promise<void> {
  const row = await readTelegramFileDownloadRow(options.database, file.assetKey);
  if (row?.latestTdlibFileId !== file.tdlibFileId) {
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
    await publishAssetOwnersAndQueue(options, [file.assetKey]);
  }
}

async function readTelegramFileDownloadRow(
  database: TelegramDatabase,
  assetKey: string
): Promise<TelegramFileDownloadRow | null> {
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
      sql`case when ${telegramFileSlots.ownerModel} = ${TELEGRAM_MESSAGE_MODEL} then 0 else 1 end`,
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
        transport: telegramFileDownloadTransport(row.ownerModel, row.ownerId)
      };
}

async function markTelegramFileDownloadReady(
  database: TelegramDatabase,
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
    .update(telegramFileDownloadJobs)
    .set({
      claimedAt: null,
      lastError: null,
      status: 'completed',
      updatedAt: sql`now()`
    })
    .where(eq(telegramFileDownloadJobs.assetKey, assetKey));
}

async function markTelegramFileDownloadDispatched(
  database: TelegramDatabase,
  assetKey: string
): Promise<void> {
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

async function markTelegramFileDownloadFailed(
  database: TelegramDatabase,
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
    .update(telegramFileDownloadJobs)
    .set({
      claimedAt: null,
      lastError: message,
      status: 'failed',
      updatedAt: sql`now()`
    })
    .where(
      and(
        eq(telegramFileDownloadJobs.assetKey, assetKey),
        sql`${telegramFileDownloadJobs.status} <> 'completed'`
      )
    );
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

async function cleanupTdlibFile(
  options: TelegramFileSubsystemOptions,
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

async function publishAssetOwnersAndQueue(
  options: TelegramFileSubsystemOptions,
  assetKeys: string[]
): Promise<void> {
  const uniqueAssetKeys = [...new Set(assetKeys)];
  if (uniqueAssetKeys.length === 0) {
    return;
  }

  const owners = await readTelegramFileOwnersForAssets(options.database, uniqueAssetKeys);
  for (const owner of owners) {
    await publishTelegramFileOwnerUpdated(options, owner);
  }
  await publishTelegramFileQueueUpdated(options);
}

async function publishTelegramFileOwnerUpdated(
  options: TelegramFileSubsystemOptions,
  owner: TelegramFileOwnerKey
): Promise<void> {
  if (owner.ownerModel === TELEGRAM_ACTIVE_NOTIFICATION_MODEL) {
    options.eventBus.publish(
      createIntegrationEvent({
        data: {},
        type: 'telegram.active_notifications.updated'
      })
    );
    return;
  }

  if (owner.ownerModel === TELEGRAM_CHAT_MODEL) {
    const chat = await chatDirectoryEntryByChatId(options.database, owner.ownerId);
    if (chat !== null) {
      options.eventBus.publish(createTelegramChatUpdatedEvent(chat));
    }
    return;
  }

  if (owner.ownerModel === TELEGRAM_DEFAULT_BACKGROUND_MODEL) {
    const selection = await readDefaultBackgroundSelection(options.database, owner.ownerId);
    if (selection !== null) {
      options.eventBus.publish(createTelegramDefaultBackgroundUpdatedEvent(selection));
    }
    return;
  }

  if (owner.ownerModel === TELEGRAM_EMOJI_CHAT_THEMES_MODEL) {
    options.eventBus.publish(
      createIntegrationEvent({
        data: {},
        type: 'telegram.emoji_chat_themes.updated'
      })
    );
    return;
  }

  const parts = telegramMessageModelParts(owner.ownerId);
  if (parts === null) {
    return;
  }
  const [message] = await options.database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(and(eq(telegramMessages.chatId, parts.chatId), eq(telegramMessages.id, parts.messageId)))
    .limit(1);
  const [readMessage] = await toReadMessages(
    options.database,
    message === undefined ? [] : [message]
  );
  if (readMessage !== undefined) {
    options.eventBus.publish(createTelegramReadMessageUpdatedEvent(readMessage));
  }
}

async function publishTelegramFileQueueUpdated(
  options: TelegramFileSubsystemOptions
): Promise<void> {
  options.eventBus.publish(
    createTelegramFileQueueUpdatedEvent(await readTelegramFileQueueStats(options.database))
  );
}

function completedFileAssetFromTdlibFile(
  file: TelegramWireFile | undefined
): Omit<TelegramCompletedFileAsset, 'assetKey'> | null {
  if (file?.local.is_downloading_completed === true && file.local.path.length > 0) {
    return {
      localPath: file.local.path,
      tdlibFileId: file.id
    };
  }
  return null;
}

function telegramFileAssetKey(file: TelegramWireFile): string {
  return file.remote.unique_id.length > 0
    ? `telegram:${file.remote.unique_id}`
    : `tdlib:${String(file.id)}`;
}

function downloadPriorityForCause(cause: TelegramMediaDownloadPolicyCause): number {
  switch (cause) {
    case 'explicit_request':
      return telegramTdlibPriorities.maximum;
    case 'operator_page':
      return telegramTdlibPriorities.high;
    case 'initialization':
    case 'live_update':
      return telegramTdlibPriorities.normal;
    case 'history_fetch':
      return telegramTdlibPriorities.low;
  }
}

function telegramFileDownloadTransport(
  ownerModel: string | null,
  ownerId: string | null
): TelegramFileDownloadTransport {
  if (ownerModel !== TELEGRAM_MESSAGE_MODEL) {
    return { kind: 'file' };
  }
  if (ownerId === null) {
    throw new Error('Telegram message file download has no owner id');
  }
  const parts = telegramMessageModelParts(ownerId);
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

function emptyBatchResult(): TelegramFileDownloadBatchResult {
  return {
    failedCount: 0,
    processedCount: 0,
    readyCount: 0
  };
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

function parseTdlibInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (Number.isSafeInteger(parsed)) {
    return parsed;
  }
  throw new Error(`Telegram ${label} must be a safe integer: ${value}`);
}

function nullablePositive(value: number): number | null {
  return value > 0 ? value : null;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function assertAssetStatus(value: string): TelegramFileAssetStatus {
  if (value === 'failed' || value === 'known' || value === 'ready') {
    return value;
  }
  throw new Error(`Unsupported Telegram file asset status: ${value}`);
}

function assertMediaKind(value: string): ExtractedTelegramFileSlot['mediaKind'] {
  if (
    value === 'avatar' ||
    value === 'document' ||
    value === 'photo' ||
    value === 'thumbnail' ||
    value === 'video' ||
    value === 'voice'
  ) {
    return value;
  }
  throw new Error(`Unsupported Telegram file media kind: ${value}`);
}

function logWorkerError(error: unknown): void {
  console.warn(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'telegram.file_subsystem_worker_failed'
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
