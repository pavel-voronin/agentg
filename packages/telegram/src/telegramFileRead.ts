import { and, eq, inArray, sql } from 'drizzle-orm';

import type { TelegramDatabase } from './database.js';
import type { TelegramFileQueueStats } from './integrationEvents.js';
import { telegramChatRef, telegramMessageRef, telegramMessageModelParts } from './modelRefs.js';
import { telegramFileAssets, telegramFileDownloadJobs, telegramFileSlots } from './schema.js';
import type {
  TelegramFileMediaKind,
  TelegramFileOwner,
  TelegramFileOwnerKey,
  TelegramFileOwnerModel,
  TelegramFileRef,
  TelegramFileRenderKind,
  TelegramFileStatus
} from './telegramFileTypes.js';
import { telegramFileRefId } from './telegramFileTypes.js';

export type { TelegramFileOwnerKey } from './telegramFileTypes.js';

type TelegramFileRefRow = {
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

const TELEGRAM_FILE_STATIC_PREFIX = '/telegram-files/';

export async function readTelegramFileOwnersForAsset(
  database: TelegramDatabase,
  assetKey: string
): Promise<TelegramFileOwnerKey[]> {
  return readTelegramFileOwnersForAssets(database, [assetKey]);
}

export async function readTelegramFileOwnersForAssets(
  database: TelegramDatabase,
  assetKeys: string[]
): Promise<TelegramFileOwnerKey[]> {
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

export async function readTelegramFileQueueStats(
  database: TelegramDatabase
): Promise<TelegramFileQueueStats> {
  const [row] = await database
    .select({
      downloadingCount: sql<number>`(select count(*) from ${telegramFileDownloadJobs} where ${telegramFileDownloadJobs.status} = ${'downloading'})::int`,
      failedCount: sql<number>`count(*) filter (where ${telegramFileAssets.status} = ${'failed'})::int`,
      knownCount: sql<number>`count(*) filter (where ${telegramFileAssets.status} = ${'known'})::int`,
      knownDownloadedBytes: sql<number>`coalesce(sum(coalesce(${telegramFileAssets.downloadedByteSize}, 0)) filter (where exists (select 1 from ${telegramFileDownloadJobs} where ${telegramFileDownloadJobs.assetKey} = ${telegramFileAssets.assetKey} and ${telegramFileDownloadJobs.status} in (${'queued'}, ${'downloading'})) and ${telegramFileAssets.byteSize} is not null), 0)::float8`,
      knownRemainingBytes: sql<number>`coalesce(sum(greatest(coalesce(${telegramFileAssets.byteSize}, 0) - coalesce(${telegramFileAssets.downloadedByteSize}, 0), 0)) filter (where exists (select 1 from ${telegramFileDownloadJobs} where ${telegramFileDownloadJobs.assetKey} = ${telegramFileAssets.assetKey} and ${telegramFileDownloadJobs.status} in (${'queued'}, ${'downloading'})) and ${telegramFileAssets.byteSize} is not null), 0)::float8`,
      knownTotalBytes: sql<number>`coalesce(sum(${telegramFileAssets.byteSize}) filter (where exists (select 1 from ${telegramFileDownloadJobs} where ${telegramFileDownloadJobs.assetKey} = ${telegramFileAssets.assetKey} and ${telegramFileDownloadJobs.status} in (${'queued'}, ${'downloading'})) and ${telegramFileAssets.byteSize} is not null), 0)::float8`,
      queuedCount: sql<number>`(select count(*) from ${telegramFileDownloadJobs} where ${telegramFileDownloadJobs.status} = ${'queued'})::int`,
      readyCount: sql<number>`count(*) filter (where ${telegramFileAssets.status} = ${'ready'})::int`,
      totalCount: sql<number>`count(*)::int`,
      unknownRemainingCount: sql<number>`count(*) filter (where exists (select 1 from ${telegramFileDownloadJobs} where ${telegramFileDownloadJobs.assetKey} = ${telegramFileAssets.assetKey} and ${telegramFileDownloadJobs.status} in (${'queued'}, ${'downloading'})) and ${telegramFileAssets.byteSize} is null)::int`
    })
    .from(telegramFileAssets);
  const queuedCount = aggregateNumber(row?.queuedCount);
  const downloadingCount = aggregateNumber(row?.downloadingCount);

  return {
    downloadingCount,
    failedCount: aggregateNumber(row?.failedCount),
    knownCount: aggregateNumber(row?.knownCount),
    knownDownloadedBytes: aggregateNumber(row?.knownDownloadedBytes),
    knownRemainingBytes: aggregateNumber(row?.knownRemainingBytes),
    knownTotalBytes: aggregateNumber(row?.knownTotalBytes),
    queuedCount,
    readyCount: aggregateNumber(row?.readyCount),
    remainingCount: queuedCount + downloadingCount,
    totalCount: aggregateNumber(row?.totalCount),
    unknownRemainingCount: aggregateNumber(row?.unknownRemainingCount)
  };
}

export async function readTelegramFileRefsForOwners(
  database: TelegramDatabase,
  owners: TelegramFileOwnerKey[]
): Promise<Map<string, TelegramFileRef[]>> {
  const ownerIds = [...new Set(owners.map((owner) => owner.ownerId))];
  if (ownerIds.length === 0) {
    return new Map();
  }

  const ownerKeys = new Set(owners.map(ownerKey));
  const rows = await readTelegramFileRefRows(database, ownerIds);
  const refsByOwner = new Map<string, TelegramFileRef[]>();

  for (const row of rows) {
    const key = ownerKey({
      ownerId: row.ownerId,
      ownerModel: assertOwnerModel(row.ownerModel)
    });
    if (!ownerKeys.has(key)) {
      continue;
    }
    refsByOwner.set(key, [...(refsByOwner.get(key) ?? []), toTelegramFileRef(row)]);
  }

  return new Map(
    [...refsByOwner.entries()].map(([key, refs]) => [
      key,
      refs.sort((left, right) => left.slotKey.localeCompare(right.slotKey))
    ])
  );
}

export async function readTelegramFileRef(
  database: TelegramDatabase,
  owner: TelegramFileOwner,
  slotKey: string
): Promise<TelegramFileRef | null> {
  const row = await readTelegramFileRefRow(database, owner, slotKey);
  return row === null ? null : toTelegramFileRef(row);
}

export async function readTelegramFileRefRow(
  database: TelegramDatabase,
  owner: TelegramFileOwner,
  slotKey: string
): Promise<TelegramFileRefRow | null> {
  const [row] = await readTelegramFileRefRows(database, [owner.id], {
    ownerModel: owner._model,
    slotKey
  });
  return row ?? null;
}

function readTelegramFileRefRows(
  database: TelegramDatabase,
  ownerIds: string[],
  filter: { ownerModel?: TelegramFileOwnerModel; slotKey?: string } = {}
): Promise<TelegramFileRefRow[]> {
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

function toTelegramFileRef(row: TelegramFileRefRow): TelegramFileRef {
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
    id: telegramFileRefId({
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
    url:
      status === 'ready' && row.assetRelativePath !== null
        ? `${TELEGRAM_FILE_STATIC_PREFIX}${encodeRelativeUrlPath(row.assetRelativePath)}`
        : null,
    width: row.width
  };
}

function effectiveFileStatus(row: TelegramFileRefRow): TelegramFileStatus {
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

function ownerRef(ownerModel: TelegramFileOwnerModel, ownerId: string): TelegramFileOwner {
  if (ownerModel === 'telegram.chat') {
    return telegramChatRef(ownerId);
  }
  const parts = telegramMessageModelParts(ownerId);
  return telegramMessageRef({
    chatId: parts?.chatId ?? ownerId,
    messageId: parts?.messageId ?? ownerId
  });
}

function canRequestFile(row: TelegramFileRefRow, status: TelegramFileStatus): boolean {
  return (
    status !== 'ready' &&
    status !== 'queued' &&
    status !== 'downloading' &&
    row.mediaKind !== 'avatar'
  );
}

function encodeRelativeUrlPath(relativePath: string): string {
  return relativePath.split('/').map(encodeURIComponent).join('/');
}

export function ownerKey(owner: TelegramFileOwnerKey): string {
  return `${owner.ownerModel}:${owner.ownerId}`;
}

function uniqueOwners(owners: TelegramFileOwnerKey[]): TelegramFileOwnerKey[] {
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

function assertOwnerModel(value: string): TelegramFileOwnerModel {
  if (value === 'telegram.chat' || value === 'telegram.message') {
    return value;
  }
  throw new Error(`Unsupported Telegram file owner model: ${value}`);
}

function assertMediaKind(value: string): TelegramFileMediaKind {
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

function assertRenderKind(value: string): TelegramFileRenderKind {
  if (value === 'audio' || value === 'download' || value === 'image' || value === 'video') {
    return value;
  }
  throw new Error(`Unsupported Telegram file render kind: ${value}`);
}
