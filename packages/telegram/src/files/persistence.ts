import { and, eq, notInArray, sql } from 'drizzle-orm';
import type { file } from 'tdlib-types';
import { recordTelemetryHistogram } from '@agentg/framework';

import type { Database } from '../database/client.js';
import {
  telegramFileAssets,
  telegramFileDownloadJobs,
  telegramFileSlots,
  telegramTdlibFiles
} from '../database/schema.js';
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
import { priorities } from '../tdlib/priority.js';
import { extractFileSlots, type FileSlotUpdate } from './extractor.js';
import { publishFileOwnersUpdated, publishFileQueueUpdated } from './events.js';
import { ownerKey } from './read.js';
import { decideFilePolicy, type MediaDownloadPolicyCause } from './policy.js';
import type { MediaDownloadPolicyRule } from './policyRules.js';
import {
  completedFileAssetFromTdlibFile,
  type FileAssetStatus,
  type FileSubsystemOptions
} from './runtime.js';
import type { ExtractedFileSlot, FileOwnerKey } from './types.js';

const METRIC_FILE_RECORD_STAGE_DURATION = 'telegram.file.record.stage.duration';

type FileSlotScope = {
  slotKeyPrefix: string;
};

type FileSlotUpdateOptions = {
  pruneStaleActiveNotificationSlots?: boolean;
};

export async function deleteStoryFileSlots(
  database: Database,
  input: { posterChatId: string; storyId: number }
): Promise<void> {
  const owner = storyRef(input);
  await database
    .delete(telegramFileSlots)
    .where(
      and(eq(telegramFileSlots.ownerModel, owner._model), eq(telegramFileSlots.ownerId, owner.id))
    );
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
    await timeFileRecordStage('prune_stale_slots', cause, 'telegram.active_notification', () =>
      deleteStaleActiveNotificationFileSlots(options.database, owners)
    );
  }

  for (const owner of owners) {
    const ownerSlots = slots.filter(
      (slot) => slot.owner._model === owner.ownerModel && slot.owner.id === owner.ownerId
    );
    const result = await timeFileRecordStage('replace_slots', cause, owner.ownerModel, () =>
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

  await timeFileRecordStage(
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

function timeFileRecordStage<T>(
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
  return timeFileRecordMetric(attributes, operation);
}

async function timeFileRecordMetric<T>(
  attributes: Record<string, string>,
  operation: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await operation();
    recordFileRecordDuration(attributes, startedAt);
    return result;
  } catch (error) {
    recordFileRecordDuration(
      {
        ...attributes,
        'error.type': metricErrorType(error)
      },
      startedAt
    );
    throw error;
  }
}

function recordFileRecordDuration(attributes: Record<string, string>, startedAt: number): void {
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

async function deleteStaleActiveNotificationFileSlots(
  database: Database,
  owners: FileOwnerKey[]
): Promise<void> {
  const ownerIds = [
    ...new Set(
      owners
        .filter((owner) => owner.ownerModel === ACTIVE_NOTIFICATION_MODEL)
        .map((owner) => owner.ownerId)
    )
  ];

  if (ownerIds.length === 0) {
    await database
      .delete(telegramFileSlots)
      .where(eq(telegramFileSlots.ownerModel, ACTIVE_NOTIFICATION_MODEL));
    return;
  }

  await database
    .delete(telegramFileSlots)
    .where(
      and(
        eq(telegramFileSlots.ownerModel, ACTIVE_NOTIFICATION_MODEL),
        notInArray(telegramFileSlots.ownerId, ownerIds)
      )
    );
}

async function replaceOwnerFileSlots(
  database: Database,
  rules: readonly MediaDownloadPolicyRule[],
  owner: FileOwnerKey,
  slots: ExtractedFileSlot[],
  cause: MediaDownloadPolicyCause
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
  await upsertTdlibFile(database, slot.file);
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
      setWhere: sql`${telegramFileSlots.assetKey} is distinct from ${assetKey} or ${telegramFileSlots.byteSize} is distinct from ${slot.byteSize} or ${telegramFileSlots.durationSeconds} is distinct from ${slot.durationSeconds} or ${telegramFileSlots.fileName} is distinct from ${slot.fileName} or ${telegramFileSlots.height} is distinct from ${slot.height} or ${telegramFileSlots.mediaKind} is distinct from ${slot.mediaKind} or ${telegramFileSlots.mimeType} is distinct from ${slot.mimeType} or ${telegramFileSlots.renderKind} is distinct from ${slot.renderKind} or ${telegramFileSlots.tdlibFileId} is distinct from ${slot.tdlibFileId} or ${telegramFileSlots.width} is distinct from ${slot.width}`,
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

async function upsertTdlibFile(database: Database, file: file): Promise<void> {
  const row = tdlibFileRow(file);
  await database
    .insert(telegramTdlibFiles)
    .values(row)
    .onConflictDoUpdate({
      set: {
        ...row,
        updatedAt: sql`now()`
      },
      setWhere: tdlibFileChangedCondition(row),
      target: telegramTdlibFiles.tdlibFileId
    });
}

function tdlibFileRow(file: file): typeof telegramTdlibFiles.$inferInsert {
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

async function upsertFileAsset(
  database: Database,
  slot: ExtractedFileSlot,
  assetKey: string
): Promise<{ assetKey: string; downloadError: string | null; status: FileAssetStatus }> {
  const byteSizeMissingCondition =
    slot.byteSize === null ? sql`false` : sql`${telegramFileAssets.byteSize} is null`;
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
      setWhere: sql`${byteSizeMissingCondition} or ${telegramFileAssets.latestTdlibFileId} is distinct from ${slot.tdlibFileId}`,
      target: telegramFileAssets.assetKey
    })
    .returning({
      assetKey: telegramFileAssets.assetKey,
      downloadError: telegramFileAssets.downloadError,
      status: telegramFileAssets.status
    });

  if (asset !== undefined) {
    return {
      assetKey: asset.assetKey,
      downloadError: asset.downloadError,
      status: assertAssetStatus(asset.status)
    };
  }

  const [existing] = await database
    .select({
      assetKey: telegramFileAssets.assetKey,
      downloadError: telegramFileAssets.downloadError,
      status: telegramFileAssets.status
    })
    .from(telegramFileAssets)
    .where(eq(telegramFileAssets.assetKey, assetKey))
    .limit(1);
  if (existing === undefined) {
    throw new Error(`Telegram file asset was not upserted: ${assetKey}`);
  }
  return {
    assetKey: existing.assetKey,
    downloadError: existing.downloadError,
    status: assertAssetStatus(existing.status)
  };
}

export async function enqueueFileAssetDownload(
  database: Database,
  assetKey: string,
  priority: number
): Promise<boolean> {
  const changed = await database
    .insert(telegramFileDownloadJobs)
    .values({
      assetKey,
      priority,
      status: 'queued'
    })
    .onConflictDoUpdate({
      set: {
        claimedAt: sql`case when ${telegramFileDownloadJobs.status} = ${'downloading'} then ${telegramFileDownloadJobs.claimedAt} else null end`,
        lastError: null,
        priority: sql`greatest(${telegramFileDownloadJobs.priority}, ${priority})`,
        status: sql`case when ${telegramFileDownloadJobs.status} = ${'downloading'} then ${'downloading'} else ${'queued'} end`,
        updatedAt: sql`now()`
      },
      setWhere: sql`${telegramFileDownloadJobs.priority} < ${priority}`,
      target: telegramFileDownloadJobs.assetKey
    })
    .returning({
      assetKey: telegramFileDownloadJobs.assetKey
    });
  await resetFileAssetFailureForRetry(database, assetKey);
  return changed.length > 0;
}

async function resetFileAssetFailureForRetry(database: Database, assetKey: string): Promise<void> {
  await database
    .update(telegramFileAssets)
    .set({
      downloadError: null,
      status: 'known',
      updatedAt: sql`now()`
    })
    .where(and(eq(telegramFileAssets.assetKey, assetKey), eq(telegramFileAssets.status, 'failed')));
}

export async function handleFileSnapshot(database: Database, file: file): Promise<string[]> {
  await upsertTdlibFile(database, file);
  const assetKey = fileAssetKey(file);
  const snapshotSignal =
    completedFileAssetFromTdlibFile(file) === null
      ? sql`${telegramFileAssets.downloadedByteSize} is distinct from ${file.local.downloaded_size}`
      : sql`true`;
  const updated = await database
    .update(telegramFileAssets)
    .set({
      downloadedByteSize: file.local.downloaded_size,
      updatedAt: sql`now()`
    })
    .where(
      and(
        eq(telegramFileAssets.assetKey, assetKey),
        eq(telegramFileAssets.latestTdlibFileId, file.id),
        sql`${telegramFileAssets.status} <> 'ready'`,
        snapshotSignal
      )
    )
    .returning({
      assetKey: telegramFileAssets.assetKey
    });

  return updated.map((asset) => asset.assetKey);
}

function tdlibFileChangedCondition(row: typeof telegramTdlibFiles.$inferInsert) {
  return sql`${telegramTdlibFiles.expectedSize} is distinct from ${row.expectedSize} or ${telegramTdlibFiles.localCanBeDeleted} is distinct from ${row.localCanBeDeleted} or ${telegramTdlibFiles.localCanBeDownloaded} is distinct from ${row.localCanBeDownloaded} or ${telegramTdlibFiles.localDownloadOffset} is distinct from ${row.localDownloadOffset} or ${telegramTdlibFiles.localDownloadedPrefixSize} is distinct from ${row.localDownloadedPrefixSize} or ${telegramTdlibFiles.localDownloadedSize} is distinct from ${row.localDownloadedSize} or ${telegramTdlibFiles.localIsDownloadingActive} is distinct from ${row.localIsDownloadingActive} or ${telegramTdlibFiles.localIsDownloadingCompleted} is distinct from ${row.localIsDownloadingCompleted} or ${telegramTdlibFiles.localPath} is distinct from ${row.localPath} or ${telegramTdlibFiles.remoteId} is distinct from ${row.remoteId} or ${telegramTdlibFiles.remoteIsUploadingActive} is distinct from ${row.remoteIsUploadingActive} or ${telegramTdlibFiles.remoteIsUploadingCompleted} is distinct from ${row.remoteIsUploadingCompleted} or ${telegramTdlibFiles.remoteUniqueId} is distinct from ${row.remoteUniqueId} or ${telegramTdlibFiles.remoteUploadedSize} is distinct from ${row.remoteUploadedSize} or ${telegramTdlibFiles.size} is distinct from ${row.size}`;
}

export function fileAssetKey(file: file): string {
  return file.remote.unique_id.length > 0
    ? `telegram:${file.remote.unique_id}`
    : `tdlib:${String(file.id)}`;
}

export function downloadPriorityForCause(cause: MediaDownloadPolicyCause): number {
  switch (cause) {
    case 'explicit_request':
      return priorities.maximum;
    case 'operator_page':
      return priorities.high;
    case 'initialization':
    case 'live_update':
      return priorities.normal;
    case 'history_fetch':
      return priorities.low;
  }
}

function nullablePositive(value: number): number | null {
  return value > 0 ? value : null;
}

function assertAssetStatus(value: string): FileAssetStatus {
  if (value === 'failed' || value === 'known' || value === 'ready') {
    return value;
  }
  throw new Error(`Unsupported Telegram file asset status: ${value}`);
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
