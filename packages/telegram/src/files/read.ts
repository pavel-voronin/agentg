import { and, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
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
  activeNotificationModelParts,
  activeNotificationRef,
  chatRef,
  defaultBackgroundRef,
  emojiChatThemesRef,
  messageRef,
  messageModelParts,
  quickReplyMessageRef,
  stickerSetRef,
  storyRef,
  userRef
} from '../model/refs.js';
import {
  telegramFileAssets,
  telegramFileDownloadJobs,
  telegramFileSlots
} from '../database/schema.js';
import type {
  FileMediaKind,
  FileOwner,
  FileOwnerKey,
  FileOwnerModel,
  FileRef,
  FileRenderKind,
  FileStatus
} from './types.js';
import { CANONICAL_FILES_DIR, DEFAULT_WORKER_DOWNLOAD_CLAIM_TIMEOUT_MS } from './runtime.js';
import { fileRefId } from './types.js';

type FileQueueStats = {
  downloadingCount: number;
  failedCount: number;
  failureReasonCounts: FailureReasonCount[];
  knownCount: number;
  knownDownloadedBytes: number;
  knownRemainingBytes: number;
  knownTotalBytes: number;
  oldestDownloadingAgeSeconds: number;
  queuedCount: number;
  readyCount: number;
  remainingCount: number;
  staleDownloadingCount: number;
  totalCount: number;
  unknownRemainingCount: number;
};

type FailureReason =
  | 'missing_tdlib_file_id'
  | 'not_found'
  | 'stale_retry_limit'
  | 'storage_io'
  | 'unknown';

type FailureReasonCount = {
  count: number;
  reason: FailureReason;
};

type FileRefRow = {
  assetByteSize: number | null;
  assetDownloadedByteSize: number | null;
  assetDownloadError: string | null;
  assetKey: string;
  assetRelativePath: string | null;
  assetStatus: string;
  assetUpdatedAt: Date;
  byteSize: number | null;
  durationSeconds: number | null;
  fileName: string | null;
  height: number | null;
  jobStatus: string | null;
  mediaKind: string;
  mimeType: string | null;
  ownerId: string;
  ownerModel: string;
  renderKind: string;
  slotKey: string;
  slotUpdatedAt: Date;
  tdlibFileId: number;
  width: number | null;
};

const FILE_STATIC_PREFIX = '/telegram-files/';
const CANONICAL_FILES_PREFIX = `${CANONICAL_FILES_DIR}/`;
const FAILURE_REASONS = [
  'missing_tdlib_file_id',
  'not_found',
  'stale_retry_limit',
  'storage_io',
  'unknown'
] as const satisfies readonly FailureReason[];

export async function readFileOwnersForAsset(
  database: Database,
  assetKey: string
): Promise<FileOwnerKey[]> {
  return readFileOwnersForAssets(database, [assetKey]);
}

export async function readFileOwnersForAssets(
  database: Database,
  assetKeys: string[]
): Promise<FileOwnerKey[]> {
  const uniqueAssetKeys = [...new Set(assetKeys)];
  if (uniqueAssetKeys.length === 0) {
    return [];
  }

  const rows = await database
    .select({
      ownerId: telegramFileSlots.ownerId,
      ownerModel: telegramFileSlots.ownerModel
    })
    .from(telegramFileSlots)
    .where(inArray(telegramFileSlots.assetKey, uniqueAssetKeys));

  return uniqueOwners(
    rows.map((row) => ({
      ownerId: row.ownerId,
      ownerModel: assertOwnerModel(row.ownerModel)
    }))
  );
}

export async function readFileQueueStats(database: Database): Promise<FileQueueStats> {
  const [assetRow] = await database
    .select({
      failedCount: sql<number>`count(*) filter (where ${telegramFileAssets.status} = ${'failed'})::int`,
      knownCount: sql<number>`count(*) filter (where ${telegramFileAssets.status} = ${'known'})::int`,
      missingTdlibFileIdFailureCount: sql<number>`count(*) filter (where ${telegramFileAssets.status} = ${'failed'} and ${telegramFileAssets.downloadError} like ${'Telegram file asset has no TDLib file id%'})::int`,
      notFoundFailureCount: sql<number>`count(*) filter (where ${telegramFileAssets.status} = ${'failed'} and ${telegramFileAssets.downloadError} = ${'Not Found'})::int`,
      readyCount: sql<number>`count(*) filter (where ${telegramFileAssets.status} = ${'ready'})::int`,
      staleRetryLimitFailureCount: sql<number>`count(*) filter (where ${telegramFileAssets.status} = ${'failed'} and ${telegramFileAssets.downloadError} like ${'Telegram file download stale retry limit reached%'})::int`,
      storageIoFailureCount: sql<number>`count(*) filter (where ${telegramFileAssets.status} = ${'failed'} and (${telegramFileAssets.downloadError} like ${'ENOENT%'} or ${telegramFileAssets.downloadError} like ${'EACCES%'} or ${telegramFileAssets.downloadError} like ${'EPERM%'}))::int`,
      totalCount: sql<number>`count(*)::int`,
      unknownFailureCount: sql<number>`count(*) filter (where ${telegramFileAssets.status} = ${'failed'} and (${telegramFileAssets.downloadError} is null or (${telegramFileAssets.downloadError} <> ${'Not Found'} and ${telegramFileAssets.downloadError} not like ${'Telegram file asset has no TDLib file id%'} and ${telegramFileAssets.downloadError} not like ${'Telegram file download stale retry limit reached%'} and ${telegramFileAssets.downloadError} not like ${'ENOENT%'} and ${telegramFileAssets.downloadError} not like ${'EACCES%'} and ${telegramFileAssets.downloadError} not like ${'EPERM%'})))::int`
    })
    .from(telegramFileAssets);
  const [jobRow] = await database
    .select({
      downloadingCount: sql<number>`count(*) filter (where ${telegramFileDownloadJobs.status} = ${'downloading'})::int`,
      knownDownloadedBytes: sql<number>`coalesce(sum(coalesce(${telegramFileAssets.downloadedByteSize}, 0)) filter (where ${telegramFileAssets.byteSize} is not null), 0)::float8`,
      knownRemainingBytes: sql<number>`coalesce(sum(greatest(coalesce(${telegramFileAssets.byteSize}, 0) - coalesce(${telegramFileAssets.downloadedByteSize}, 0), 0)) filter (where ${telegramFileAssets.byteSize} is not null), 0)::float8`,
      knownTotalBytes: sql<number>`coalesce(sum(${telegramFileAssets.byteSize}) filter (where ${telegramFileAssets.byteSize} is not null), 0)::float8`,
      oldestDownloadingAgeSeconds: sql<number>`coalesce(extract(epoch from now() - (min(coalesce(${telegramFileDownloadJobs.claimedAt}, ${telegramFileDownloadJobs.updatedAt})) filter (where ${telegramFileDownloadJobs.status} = ${'downloading'}))), 0)::float8`,
      queuedCount: sql<number>`count(*) filter (where ${telegramFileDownloadJobs.status} = ${'queued'})::int`,
      staleDownloadingCount: sql<number>`count(*) filter (where ${telegramFileDownloadJobs.status} = ${'downloading'} and coalesce(${telegramFileDownloadJobs.claimedAt}, ${telegramFileDownloadJobs.updatedAt}) < now() - (${DEFAULT_WORKER_DOWNLOAD_CLAIM_TIMEOUT_MS} * interval '1 millisecond'))::int`,
      unknownRemainingCount: sql<number>`count(*) filter (where ${telegramFileAssets.byteSize} is null)::int`
    })
    .from(telegramFileDownloadJobs)
    .innerJoin(
      telegramFileAssets,
      eq(telegramFileAssets.assetKey, telegramFileDownloadJobs.assetKey)
    )
    .where(inArray(telegramFileDownloadJobs.status, ['queued', 'downloading']));
  const queuedCount = aggregateNumber(jobRow?.queuedCount);
  const downloadingCount = aggregateNumber(jobRow?.downloadingCount);

  return {
    downloadingCount,
    failedCount: aggregateNumber(assetRow?.failedCount),
    failureReasonCounts: failureReasonCounts(assetRow),
    knownCount: aggregateNumber(assetRow?.knownCount),
    knownDownloadedBytes: aggregateNumber(jobRow?.knownDownloadedBytes),
    knownRemainingBytes: aggregateNumber(jobRow?.knownRemainingBytes),
    knownTotalBytes: aggregateNumber(jobRow?.knownTotalBytes),
    oldestDownloadingAgeSeconds: aggregateNumber(jobRow?.oldestDownloadingAgeSeconds),
    queuedCount,
    readyCount: aggregateNumber(assetRow?.readyCount),
    remainingCount: queuedCount + downloadingCount,
    staleDownloadingCount: aggregateNumber(jobRow?.staleDownloadingCount),
    totalCount: aggregateNumber(assetRow?.totalCount),
    unknownRemainingCount: aggregateNumber(jobRow?.unknownRemainingCount)
  };
}

function failureReasonCounts(
  row:
    | {
        missingTdlibFileIdFailureCount: number;
        notFoundFailureCount: number;
        staleRetryLimitFailureCount: number;
        storageIoFailureCount: number;
        unknownFailureCount: number;
      }
    | undefined
): FailureReasonCount[] {
  const counts = {
    missing_tdlib_file_id: aggregateNumber(row?.missingTdlibFileIdFailureCount),
    not_found: aggregateNumber(row?.notFoundFailureCount),
    stale_retry_limit: aggregateNumber(row?.staleRetryLimitFailureCount),
    storage_io: aggregateNumber(row?.storageIoFailureCount),
    unknown: aggregateNumber(row?.unknownFailureCount)
  } satisfies Record<FailureReason, number>;
  return FAILURE_REASONS.map((reason) => ({
    count: counts[reason],
    reason
  }));
}

export async function readFileRefsForOwners(
  database: Database,
  owners: FileOwnerKey[]
): Promise<Map<string, FileRef[]>> {
  const ownerIds = [...new Set(owners.map((owner) => owner.ownerId))];
  if (ownerIds.length === 0) {
    return new Map();
  }

  const ownerKeys = new Set(owners.map(ownerKey));
  const rows = await readFileRefRows(database, ownerIds);
  const refsByOwner = new Map<string, FileRef[]>();

  for (const row of rows) {
    const key = ownerKey({
      ownerId: row.ownerId,
      ownerModel: assertOwnerModel(row.ownerModel)
    });
    if (!ownerKeys.has(key)) {
      continue;
    }
    refsByOwner.set(key, [...(refsByOwner.get(key) ?? []), toFileRef(row)]);
  }

  return new Map(
    [...refsByOwner.entries()].map(([key, refs]) => [
      key,
      refs.sort((left, right) => left.slotKey.localeCompare(right.slotKey))
    ])
  );
}

export async function readFileRef(
  database: Database,
  owner: FileOwner,
  slotKey: string
): Promise<FileRef | null> {
  const row = await readFileRefRow(database, owner, slotKey);
  return row === null ? null : toFileRef(row);
}

export async function readFileRefRow(
  database: Database,
  owner: FileOwner,
  slotKey: string
): Promise<FileRefRow | null> {
  const [row] = await readFileRefRows(database, [owner.id], {
    ownerModel: owner._model,
    slotKey
  });
  return row ?? null;
}

function readFileRefRows(
  database: Database,
  ownerIds: string[],
  filter: { ownerModel?: FileOwnerModel; slotKey?: string } = {}
): Promise<FileRefRow[]> {
  const where = [
    inArray(telegramFileSlots.ownerId, ownerIds),
    filter.ownerModel === undefined
      ? undefined
      : eq(telegramFileSlots.ownerModel, filter.ownerModel),
    filter.slotKey === undefined ? undefined : eq(telegramFileSlots.slotKey, filter.slotKey)
  ].filter(
    (condition): condition is Exclude<typeof condition, undefined> => condition !== undefined
  );

  return database
    .select({
      assetByteSize: telegramFileAssets.byteSize,
      assetDownloadedByteSize: telegramFileAssets.downloadedByteSize,
      assetDownloadError: telegramFileAssets.downloadError,
      assetKey: telegramFileSlots.assetKey,
      assetRelativePath: telegramFileAssets.relativePath,
      assetStatus: telegramFileAssets.status,
      assetUpdatedAt: telegramFileAssets.updatedAt,
      byteSize: telegramFileSlots.byteSize,
      durationSeconds: telegramFileSlots.durationSeconds,
      fileName: telegramFileSlots.fileName,
      height: telegramFileSlots.height,
      jobStatus: telegramFileDownloadJobs.status,
      mediaKind: telegramFileSlots.mediaKind,
      mimeType: telegramFileSlots.mimeType,
      ownerId: telegramFileSlots.ownerId,
      ownerModel: telegramFileSlots.ownerModel,
      renderKind: telegramFileSlots.renderKind,
      slotKey: telegramFileSlots.slotKey,
      slotUpdatedAt: telegramFileSlots.updatedAt,
      tdlibFileId: telegramFileSlots.tdlibFileId,
      width: telegramFileSlots.width
    })
    .from(telegramFileSlots)
    .innerJoin(telegramFileAssets, eq(telegramFileAssets.assetKey, telegramFileSlots.assetKey))
    .leftJoin(
      telegramFileDownloadJobs,
      eq(telegramFileDownloadJobs.assetKey, telegramFileSlots.assetKey)
    )
    .where(and(...where));
}

function toFileRef(row: FileRefRow): FileRef {
  const owner = ownerRef(assertOwnerModel(row.ownerModel), row.ownerId);
  const status = effectiveFileStatus(row);
  return {
    _model: 'telegram.file',
    byteSize: row.assetByteSize ?? row.byteSize,
    canRequest: canRequestFile(row, status),
    downloadedByteSize: row.assetDownloadedByteSize,
    downloadError: row.assetDownloadError,
    durationSeconds: row.durationSeconds,
    fileName: row.fileName,
    height: row.height,
    id: fileRefId({
      ownerId: row.ownerId,
      ownerModel: owner._model,
      slotKey: row.slotKey
    }),
    mediaKind: assertMediaKind(row.mediaKind),
    mimeType: row.mimeType,
    owner,
    renderKind: assertRenderKind(row.renderKind),
    slotKey: row.slotKey,
    status,
    updatedAt: maxDate(row.assetUpdatedAt, row.slotUpdatedAt).toISOString(),
    url: readyFileUrl(status, row.assetRelativePath),
    width: row.width
  };
}

function effectiveFileStatus(row: FileRefRow): FileStatus {
  if (row.assetStatus === 'ready') {
    return 'ready';
  }
  if (row.jobStatus === 'queued' || row.jobStatus === 'downloading') {
    return row.jobStatus;
  }
  if (row.assetStatus === 'failed') {
    return 'failed';
  }
  return 'known';
}

function ownerRef(ownerModel: FileOwnerModel, ownerId: string): FileOwner {
  if (ownerModel === ACTIVE_NOTIFICATION_MODEL) {
    const parts = activeNotificationModelParts(ownerId);
    return activeNotificationRef({
      groupId: parts?.groupId ?? ownerId,
      notificationId: parts?.notificationId ?? ownerId
    });
  }
  if (ownerModel === CHAT_MODEL) {
    return chatRef(ownerId);
  }
  if (ownerModel === DEFAULT_BACKGROUND_MODEL) {
    return defaultBackgroundRef(ownerId);
  }
  if (ownerModel === EMOJI_CHAT_THEMES_MODEL) {
    return emojiChatThemesRef();
  }
  if (ownerModel === QUICK_REPLY_MESSAGE_MODEL) {
    return quickReplyMessageRef(ownerId);
  }
  if (ownerModel === STICKER_SET_MODEL) {
    return stickerSetRef(ownerId);
  }
  if (ownerModel === STORY_MODEL) {
    const parts = messageModelParts(ownerId);
    return storyRef({
      posterChatId: parts?.chatId ?? ownerId,
      storyId: parts?.messageId ?? ownerId
    });
  }
  if (ownerModel === USER_MODEL) {
    return userRef(ownerId);
  }
  const parts = messageModelParts(ownerId);
  return messageRef({
    chatId: parts?.chatId ?? ownerId,
    messageId: parts?.messageId ?? ownerId
  });
}

function canRequestFile(row: FileRefRow, status: FileStatus): boolean {
  return (
    status !== 'ready' &&
    status !== 'queued' &&
    status !== 'downloading' &&
    row.mediaKind !== 'avatar'
  );
}

function readyFileUrl(status: FileStatus, relativePath: string | null): string | null {
  if (status !== 'ready' || relativePath === null || !safeCanonicalRelativePath(relativePath)) {
    return null;
  }
  return `${FILE_STATIC_PREFIX}${encodeRelativeUrlPath(relativePath)}`;
}

function safeCanonicalRelativePath(relativePath: string): boolean {
  if (!relativePath.startsWith(CANONICAL_FILES_PREFIX)) {
    return false;
  }
  const pathSegments = relativePath.slice(CANONICAL_FILES_PREFIX.length).split('/');
  return pathSegments.every(safeCanonicalPathSegment);
}

function safeCanonicalPathSegment(segment: string): boolean {
  if (segment.length === 0 || segment.includes('\\')) {
    return false;
  }
  try {
    const decoded = decodeURIComponent(segment);
    return (
      decoded.length > 0 &&
      decoded !== '.' &&
      decoded !== '..' &&
      !decoded.includes('/') &&
      !decoded.includes('\\')
    );
  } catch {
    return false;
  }
}

function encodeRelativeUrlPath(relativePath: string): string {
  return relativePath.split('/').map(encodeURIComponent).join('/');
}

export function ownerKey(owner: FileOwnerKey): string {
  return `${owner.ownerModel}:${owner.ownerId}`;
}

function uniqueOwners(owners: FileOwnerKey[]): FileOwnerKey[] {
  return [...new Map(owners.map((owner) => [ownerKey(owner), owner])).values()];
}

function aggregateNumber(value: unknown): number {
  const numberValue =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function maxDate(left: Date, right: Date): Date {
  return left > right ? left : right;
}

function assertOwnerModel(value: string): FileOwnerModel {
  if (
    value === ACTIVE_NOTIFICATION_MODEL ||
    value === CHAT_MODEL ||
    value === DEFAULT_BACKGROUND_MODEL ||
    value === EMOJI_CHAT_THEMES_MODEL ||
    value === MESSAGE_MODEL ||
    value === QUICK_REPLY_MESSAGE_MODEL ||
    value === STICKER_SET_MODEL ||
    value === STORY_MODEL ||
    value === USER_MODEL
  ) {
    return value;
  }
  throw new Error(`Unsupported Telegram file owner model: ${value}`);
}

function assertMediaKind(value: string): FileMediaKind {
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

function assertRenderKind(value: string): FileRenderKind {
  if (value === 'audio' || value === 'download' || value === 'image' || value === 'video') {
    return value;
  }
  throw new Error(`Unsupported Telegram file render kind: ${value}`);
}
