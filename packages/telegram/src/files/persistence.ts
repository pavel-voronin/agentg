import { recordTelemetryHistogram } from '@agentg/framework';

import type { Database } from '../database/client.js';
import type { FileSnapshot } from '../domain/models/fileSnapshot.js';
import {
  ACTIVE_NOTIFICATION_MODEL,
  CHAT_MODEL,
  DEFAULT_BACKGROUND_MODEL,
  EMOJI_CHAT_THEMES_MODEL,
  MESSAGE_MODEL,
  QUICK_REPLY_MESSAGE_MODEL,
  STICKER_SET_MODEL,
  STORY_MODEL,
  USER_MODEL,
  activeNotificationRef,
  emojiChatThemesRef,
  messageRef,
  quickReplyMessageRef,
  stickerSetRef,
  storyRef,
  userRef
} from '../model/refs.js';
import { extractFileSlots, type FileSlotUpdate } from './extractor.js';
import { publishFileOwnersUpdated, publishFileQueueUpdated } from './events.js';
import { ownerKey } from '../storage/fileReadStorage.js';
import {
  deleteOwnerFileSlots,
  deleteOwnerFileSlotsExcept,
  deleteStaleActiveNotificationFileSlots as deleteStaleActiveNotificationFileSlotRecords,
  deleteStoryFileSlots as deleteStoryFileSlotRecords,
  enqueueFileAssetDownload,
  fileAssetKey,
  handleFileSnapshot as handleFileSnapshotRecord,
  readOwnerFileSlotKeys,
  upsertExtractedFileSnapshot,
  upsertFileAsset,
  upsertFileSlot
} from '../storage/filePersistenceStorage.js';
import { decideFilePolicy, type MediaDownloadPolicyCause } from './policy.js';
import type { MediaDownloadPolicyRule } from './policyRules.js';
import { completedFileAssetFromTdlibFile, type FileSubsystemOptions } from './runtime.js';
import type { ExtractedFileSlot, FileOwnerKey } from './types.js';

export { enqueueFileAssetDownload, fileAssetKey } from '../storage/filePersistenceStorage.js';

const METRIC_FILE_RECORD_STAGE_DURATION = 'telegram.file.record.stage.duration';
const FILE_PRIORITY_HIGH = 24;
const FILE_PRIORITY_LOW = 8;
const FILE_PRIORITY_MAXIMUM = 32;
const FILE_PRIORITY_NORMAL = 16;

export type FileSlotScope = {
  slotKeyPrefix: string;
};

export type FileSlotUpdateOptions = {
  pruneStaleActiveNotificationSlots?: boolean;
};

export async function refreshMessageFileSlot(
  database: Database,
  input: {
    assetKey: string;
    chatId: string;
    content: NonNullable<FileSlotUpdate['message']>['content'];
    messageId: string;
    slotKey: string;
  }
): Promise<
  | { kind: 'asset_changed'; assetKey: string }
  | { kind: 'refreshed'; tdlibFileId: number }
  | { kind: 'slot_missing' }
> {
  const message =
    input.content === undefined
      ? {
          chatId: input.chatId,
          messageId: input.messageId
        }
      : {
          chatId: input.chatId,
          content: input.content,
          messageId: input.messageId
        };
  const slot = extractFileSlots({
    message
  }).find((candidate) => candidate.slotKey === input.slotKey);

  if (slot === undefined) {
    return { kind: 'slot_missing' };
  }

  const assetKey = fileAssetKey(slot.file);
  if (assetKey !== input.assetKey) {
    return {
      assetKey,
      kind: 'asset_changed'
    };
  }

  await upsertExtractedFileSnapshot(database, slot.file);
  await upsertFileAsset(database, slot, assetKey);
  await upsertFileSlot(database, slot, assetKey);
  return {
    kind: 'refreshed',
    tdlibFileId: slot.tdlibFileId
  };
}

export async function deleteStoryFileSlots(
  database: Database,
  input: { posterChatId: string; storyId: number }
): Promise<void> {
  await deleteStoryFileSlotRecords(database, input);
}

export async function recordFileSlotUpdate(
  options: FileSubsystemOptions,
  update: FileSlotUpdate,
  cause: MediaDownloadPolicyCause,
  scope?: FileSlotScope,
  updateOptions: FileSlotUpdateOptions = {}
): Promise<boolean> {
  const slots = extractFileSlots(update);
  const owners = updateFileOwners(update);
  const changedOwners = new Map<string, FileOwnerKey>();
  let queueChanged = false;

  if (updateOptions.pruneStaleActiveNotificationSlots === true) {
    await timeFileStateStage('prune_stale_slots', cause, 'telegram.active_notification', () =>
      deleteStaleActiveNotificationFileSlotRecords(options.database, owners)
    );
  }

  for (const owner of owners) {
    const ownerSlots = slots.filter(
      (slot) => slot.owner._model === owner.ownerModel && slot.owner.id === owner.ownerId
    );
    const result = await timeFileStateStage('replace_slots', cause, owner.ownerModel, () =>
      scope === undefined
        ? replaceOwnerFileSlots(
            options.database,
            options.getDownloadRules(),
            owner,
            ownerSlots,
            cause
          )
        : replaceOwnerFileSlotsInScope(
            options.database,
            options.getDownloadRules(),
            owner,
            ownerSlots,
            cause,
            scope
          )
    );
    if (result.ownerChanged) {
      changedOwners.set(ownerKey(owner), owner);
    }
    queueChanged ||= result.queueChanged;
  }

  await timeFileStateStage(
    'publish_changes',
    cause,
    ownerModelLabel(changedOwners.values()),
    async () => {
      await publishFileOwnersUpdated(options, [...changedOwners.values()]);
      if (queueChanged) {
        await publishFileQueueUpdated(options);
      }
    }
  );
  return queueChanged;
}

function timeFileStateStage<T>(
  stage: string,
  cause: MediaDownloadPolicyCause,
  ownerModel: string,
  operation: () => Promise<T>
): Promise<T> {
  const attributes = {
    'telegram.file.owner_model': ownerModel,
    'telegram.file.record.cause': cause,
    'telegram.file.record.stage': stage
  };
  return timeFileStateMetric(attributes, operation);
}

async function timeFileStateMetric<T>(
  attributes: Record<string, string>,
  operation: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await operation();
    recordFileStateDuration(attributes, startedAt);
    return result;
  } catch (error) {
    recordFileStateDuration(
      {
        ...attributes,
        'error.type': metricErrorType(error)
      },
      startedAt
    );
    throw error;
  }
}

function recordFileStateDuration(attributes: Record<string, string>, startedAt: number): void {
  recordTelemetryHistogram(
    METRIC_FILE_RECORD_STAGE_DURATION,
    Math.max(0, performance.now() - startedAt) / 1000,
    attributes,
    { unit: 's' }
  );
}

function metricErrorType(error: unknown): string {
  if (error instanceof Error && error.name.length > 0) {
    return error.name;
  }
  return typeof error;
}

function ownerModelLabel(owners: Iterable<FileOwnerKey>): string {
  const models = [...new Set([...owners].map((owner) => owner.ownerModel))];
  if (models.length === 0) {
    return 'none';
  }
  if (models.length === 1) {
    return models[0] ?? 'none';
  }
  return 'multiple';
}

function updateFileOwners(update: FileSlotUpdate): FileOwnerKey[] {
  return [
    ...(update.chat === undefined
      ? []
      : [
          {
            ownerId: update.chat.id,
            ownerModel: CHAT_MODEL
          }
        ]),
    ...(update.chatBackground === undefined
      ? []
      : [
          {
            ownerId: update.chatBackground.chatId,
            ownerModel: CHAT_MODEL
          }
        ]),
    ...(update.chatPhoto === undefined
      ? []
      : [
          {
            ownerId: update.chatPhoto.chatId,
            ownerModel: CHAT_MODEL
          }
        ]),
    ...(update.chatTheme === undefined
      ? []
      : [
          {
            ownerId: update.chatTheme.chatId,
            ownerModel: CHAT_MODEL
          }
        ]),
    ...(update.defaultBackground === undefined
      ? []
      : [
          {
            ownerId: update.defaultBackground.key,
            ownerModel: DEFAULT_BACKGROUND_MODEL
          }
        ]),
    ...(update.emojiChatThemes === undefined
      ? []
      : [
          {
            ownerId: emojiChatThemesRef().id,
            ownerModel: EMOJI_CHAT_THEMES_MODEL
          }
        ]),
    ...(update.message === undefined
      ? []
      : [
          {
            ownerId: messageRef({
              chatId: update.message.chatId,
              messageId: update.message.messageId
            }).id,
            ownerModel: MESSAGE_MODEL
          }
        ]),
    ...(update.contentUpdate === undefined
      ? []
      : [
          {
            ownerId: messageRef({
              chatId: update.contentUpdate.chatId,
              messageId: update.contentUpdate.messageId
            }).id,
            ownerModel: MESSAGE_MODEL
          }
        ]),
    ...(update.notificationGroups === undefined
      ? []
      : notificationGroupFileOwners(update.notificationGroups.groups)),
    ...(update.quickReplyMessage === undefined
      ? []
      : [
          {
            ownerId: quickReplyMessageRef(update.quickReplyMessage.messageId).id,
            ownerModel: QUICK_REPLY_MESSAGE_MODEL
          }
        ]),
    ...(update.stickerSet === undefined
      ? []
      : [
          {
            ownerId: stickerSetRef(update.stickerSet.id).id,
            ownerModel: STICKER_SET_MODEL
          }
        ]),
    ...(update.stickerSetInfos === undefined
      ? []
      : update.stickerSetInfos.sets
          .map((stickerSet) => safeTdlibId(stickerSet.id))
          .filter((stickerSetId): stickerSetId is string => stickerSetId !== null)
          .map((stickerSetId) => ({
            ownerId: stickerSetRef(stickerSetId).id,
            ownerModel: STICKER_SET_MODEL
          }))),
    ...(update.story === undefined
      ? []
      : [
          {
            ownerId: storyRef({
              posterChatId: update.story.posterChatId,
              storyId: update.story.storyId
            }).id,
            ownerModel: STORY_MODEL
          }
        ]),
    ...(update.userFullInfo === undefined
      ? []
      : [
          {
            ownerId: userRef(update.userFullInfo.userId).id,
            ownerModel: USER_MODEL
          }
        ])
  ];
}

function notificationGroupFileOwners(groups: Record<string, unknown>[]): FileOwnerKey[] {
  const owners: FileOwnerKey[] = [];

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
            ownerId: messageRef({ chatId, messageId }).id,
            ownerModel: MESSAGE_MODEL
          });
        }
      }

      if (type?._ === 'notificationTypeNewPushMessage') {
        const notificationId = safeTdlibId(notification.id);
        if (groupId !== null && notificationId !== null) {
          owners.push({
            ownerId: activeNotificationRef({ groupId, notificationId }).id,
            ownerModel: ACTIVE_NOTIFICATION_MODEL
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

async function replaceOwnerFileSlots(
  database: Database,
  rules: readonly MediaDownloadPolicyRule[],
  owner: FileOwnerKey,
  slots: ExtractedFileSlot[],
  cause: MediaDownloadPolicyCause
): Promise<{ ownerChanged: boolean; queueChanged: boolean }> {
  const currentSlotKeys = await readOwnerFileSlotKeys(database, owner);

  if (slots.length === 0) {
    const removedCount = await deleteOwnerFileSlots(database, owner);
    return {
      ownerChanged: removedCount > 0,
      queueChanged: false
    };
  }

  const slotKeys = slots.map((slot) => slot.slotKey);
  const removedCount = await deleteOwnerFileSlotsExcept(database, owner, slotKeys);
  let ownerChanged = removedCount > 0;
  let queueChanged = false;

  for (const slot of slots) {
    const changedSlot = await upsertExtractedSlot(database, rules, slot, cause);
    ownerChanged ||= changedSlot.ownerChanged || !currentSlotKeys.has(slot.slotKey);
    queueChanged ||= changedSlot.queueChanged;
  }

  return { ownerChanged, queueChanged };
}

async function replaceOwnerFileSlotsInScope(
  database: Database,
  rules: readonly MediaDownloadPolicyRule[],
  owner: FileOwnerKey,
  slots: ExtractedFileSlot[],
  cause: MediaDownloadPolicyCause,
  scope: FileSlotScope
): Promise<{ ownerChanged: boolean; queueChanged: boolean }> {
  const currentSlotKeys = await readOwnerFileSlotKeys(database, owner, scope);

  if (slots.length === 0) {
    const removedCount = await deleteOwnerFileSlots(database, owner, scope);
    return {
      ownerChanged: removedCount > 0,
      queueChanged: false
    };
  }

  const slotKeys = slots.map((slot) => slot.slotKey);
  const removedCount = await deleteOwnerFileSlotsExcept(database, owner, slotKeys, scope);
  let ownerChanged = removedCount > 0;
  let queueChanged = false;

  for (const slot of slots) {
    const changedSlot = await upsertExtractedSlot(database, rules, slot, cause);
    ownerChanged ||= changedSlot.ownerChanged || !currentSlotKeys.has(slot.slotKey);
    queueChanged ||= changedSlot.queueChanged;
  }

  return { ownerChanged, queueChanged };
}

async function upsertExtractedSlot(
  database: Database,
  rules: readonly MediaDownloadPolicyRule[],
  slot: ExtractedFileSlot,
  cause: MediaDownloadPolicyCause
): Promise<{ ownerChanged: boolean; queueChanged: boolean }> {
  await upsertExtractedFileSnapshot(database, slot.file);
  const assetKey = fileAssetKey(slot.file);
  const asset = await upsertFileAsset(database, slot, assetKey);
  const decision = decideFilePolicy({
    cause,
    current: {
      failureReason: asset.downloadError,
      sourceFingerprint: assetKey,
      status: asset.status
    },
    rules,
    slot,
    sourceFingerprint: assetKey
  });
  let queueChanged = false;

  if (decision.action === 'enqueue' && asset.status !== 'ready') {
    queueChanged = await enqueueFileAssetDownload(
      database,
      assetKey,
      downloadPriorityForCause(cause)
    );
  }

  const ownerChanged = await upsertFileSlot(database, slot, assetKey);
  return {
    ownerChanged,
    queueChanged
  };
}

export async function handleFileSnapshot(
  database: Database,
  file: FileSnapshot
): Promise<string[]> {
  return handleFileSnapshotRecord(database, {
    file,
    isCompleted: completedFileAssetFromTdlibFile(file) !== null
  });
}

export function downloadPriorityForCause(cause: MediaDownloadPolicyCause): number {
  switch (cause) {
    case 'explicit_request':
      return FILE_PRIORITY_MAXIMUM;
    case 'operator_page':
      return FILE_PRIORITY_HIGH;
    case 'initialization':
    case 'live_update':
      return FILE_PRIORITY_NORMAL;
    case 'history_fetch':
      return FILE_PRIORITY_LOW;
  }
}

export function assertMediaKind(value: string): ExtractedFileSlot['mediaKind'] {
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
