import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';

import type { JsonObject } from '@agentg/events/json';

import type { TelegramDatabase as AppDatabase } from './database.js';
import type { TelegramFileQueueStats } from './integration-events.js';
import { telegramChatRef, telegramMessageRef, telegramMessageModelParts } from './model-refs.js';
import type { NormalizedTelegramUpdate } from './normalize.js';
import { telegramFileAssets, telegramFileDownloadJobs, telegramFiles } from './schema.js';
import {
  extractTelegramFileSlots,
  telegramFileSourceFingerprint
} from './telegram-file-extractor.js';
import { telegramTdlibPriorities } from './telegram-tdlib-priority.js';
import {
  decideTelegramFilePolicy,
  type TelegramFilePolicyDecision,
  type TelegramMediaDownloadPolicyCause
} from './telegram-file-policy.js';
import type {
  ExtractedTelegramFileSlot,
  TelegramFileMediaKind,
  TelegramFileOwner,
  TelegramFileOwnerModel,
  TelegramFileRef,
  TelegramFileRenderKind,
  TelegramFileSource,
  TelegramFileStatus
} from './telegram-file-types.js';
import { telegramFileRefId } from './telegram-file-types.js';

export type TelegramFileOwnerKey = {
  ownerId: string;
  ownerModel: TelegramFileOwnerModel;
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
};

export type StoredCanonicalFile = {
  byteSize: number;
  relativePath: string;
  sha256: string;
};

type TelegramFileAssetStatus = 'failed' | 'known' | 'ready';
type TelegramFileDownloadJobStatus = 'completed' | 'downloading' | 'failed' | 'queued';

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
  source: JsonObject;
  sourceFingerprint: string;
  tdlibFileId: number | null;
  width: number | null;
};

const TELEGRAM_FILE_STATIC_PREFIX = '/telegram-files/';

export async function syncTelegramFileSlots(
  database: AppDatabase,
  update: NormalizedTelegramUpdate,
  cause: TelegramMediaDownloadPolicyCause
): Promise<TelegramFileOwnerKey[]> {
  const slots = extractTelegramFileSlots(update);
  const owners = updateFileOwners(update);
  const changedOwners = new Map<string, TelegramFileOwnerKey>();

  for (const owner of owners) {
    const ownerSlots = slots.filter(
      (slot) => slot.owner._model === owner.ownerModel && slot.owner.id === owner.ownerId
    );
    const ownerChanged = await replaceOwnerFileSlots(database, owner, ownerSlots, cause);
    if (ownerChanged) {
      changedOwners.set(ownerKey(owner), owner);
    }
  }

  return [...changedOwners.values()];
}

export async function applyTelegramFileProgressUpdate(
  database: AppDatabase,
  update: unknown
): Promise<TelegramFileOwnerKey[]> {
  const file = asPlainRecord(asPlainRecord(update)?.file);
  const fileId = safeInteger(file?.id);
  if (asPlainRecord(update)?._ !== 'updateFile' || fileId === null) {
    return [];
  }

  const local = asPlainRecord(file?.local);
  const downloadedByteSize = safeNonNegativeInteger(local?.downloaded_size);
  if (downloadedByteSize === null) {
    return [];
  }

  const assets = await database
    .update(telegramFileAssets)
    .set({
      downloadedByteSize,
      updatedAt: sql`now()`
    })
    .where(
      and(
        eq(telegramFileAssets.latestTdlibFileId, fileId),
        sql`${telegramFileAssets.status} <> 'ready'`
      )
    )
    .returning({
      assetKey: telegramFileAssets.assetKey
    });

  return readTelegramFileOwnersForAssets(
    database,
    assets.map((asset) => asset.assetKey)
  );
}

export async function requestTelegramFile(
  database: AppDatabase,
  input: { owner: TelegramFileOwner; slotKey: string }
): Promise<TelegramFileRequestResult> {
  const row = await readTelegramFileRefRow(database, input.owner, input.slotKey);
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
      status: effectiveFileStatus(row)
    },
    slot: extractedSlotFromRow(row),
    sourceFingerprint: row.assetKey
  });

  if (decision.action === 'enqueue' && row.assetStatus !== 'ready') {
    await enqueueTelegramFileAssetDownload(
      database,
      row.assetKey,
      downloadPriorityForCause('explicit_request')
    );
  }

  return {
    decision,
    file: await readTelegramFileRef(database, input.owner, input.slotKey)
  };
}

export async function requeueStaleTelegramFileDownloads(
  database: AppDatabase,
  staleBefore: Date
): Promise<TelegramFileOwnerKey[]> {
  const jobs = await database
    .update(telegramFileDownloadJobs)
    .set({
      claimedAt: null,
      status: 'queued',
      updatedAt: sql`now()`
    })
    .where(
      and(
        eq(telegramFileDownloadJobs.status, 'downloading'),
        sql`coalesce(${telegramFileDownloadJobs.claimedAt}, ${telegramFileDownloadJobs.updatedAt}) < ${staleBefore}`
      )
    )
    .returning({
      assetKey: telegramFileDownloadJobs.assetKey
    });

  return readTelegramFileOwnersForAssets(
    database,
    jobs.map((job) => job.assetKey)
  );
}

export async function claimNextQueuedTelegramFileDownload(
  database: AppDatabase
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

export async function markTelegramFileDownloadReady(
  database: AppDatabase,
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

export async function markTelegramFileDownloadFailed(
  database: AppDatabase,
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
    .where(eq(telegramFileAssets.assetKey, assetKey));

  await database
    .update(telegramFileDownloadJobs)
    .set({
      claimedAt: null,
      lastError: message,
      status: 'failed',
      updatedAt: sql`now()`
    })
    .where(eq(telegramFileDownloadJobs.assetKey, assetKey));
}

export async function readTelegramFileOwnersForAsset(
  database: AppDatabase,
  assetKey: string
): Promise<TelegramFileOwnerKey[]> {
  return readTelegramFileOwnersForAssets(database, [assetKey]);
}

export async function readTelegramFileOwnersForAssets(
  database: AppDatabase,
  assetKeys: string[]
): Promise<TelegramFileOwnerKey[]> {
  const uniqueAssetKeys = [...new Set(assetKeys)];
  if (uniqueAssetKeys.length === 0) {
    return [];
  }

  const rows = await database
    .select({
      ownerId: telegramFiles.ownerId,
      ownerModel: telegramFiles.ownerModel
    })
    .from(telegramFiles)
    .where(inArray(telegramFiles.assetKey, uniqueAssetKeys));

  return uniqueOwners(
    rows.map((row) => ({
      ownerId: row.ownerId,
      ownerModel: assertOwnerModel(row.ownerModel)
    }))
  );
}

export async function readTelegramFileQueueStats(
  database: AppDatabase
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
  database: AppDatabase,
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

function updateFileOwners(update: NormalizedTelegramUpdate): TelegramFileOwnerKey[] {
  return [
    ...(update.chat === undefined
      ? []
      : [
          {
            ownerId: update.chat.id,
            ownerModel: 'telegram.chat' as const
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
            ownerModel: 'telegram.message' as const
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
            ownerModel: 'telegram.message' as const
          }
        ])
  ];
}

async function replaceOwnerFileSlots(
  database: AppDatabase,
  owner: TelegramFileOwnerKey,
  slots: ExtractedTelegramFileSlot[],
  cause: TelegramMediaDownloadPolicyCause
): Promise<boolean> {
  const currentRows = await database
    .select({
      slotKey: telegramFiles.slotKey
    })
    .from(telegramFiles)
    .where(
      and(eq(telegramFiles.ownerModel, owner.ownerModel), eq(telegramFiles.ownerId, owner.ownerId))
    );

  if (slots.length === 0) {
    const removed = await database
      .delete(telegramFiles)
      .where(
        and(
          eq(telegramFiles.ownerModel, owner.ownerModel),
          eq(telegramFiles.ownerId, owner.ownerId)
        )
      )
      .returning({
        slotKey: telegramFiles.slotKey
      });
    return removed.length > 0;
  }

  const slotKeys = slots.map((slot) => slot.slotKey);
  const removed = await database
    .delete(telegramFiles)
    .where(
      and(
        eq(telegramFiles.ownerModel, owner.ownerModel),
        eq(telegramFiles.ownerId, owner.ownerId),
        notInArray(telegramFiles.slotKey, slotKeys)
      )
    )
    .returning({
      slotKey: telegramFiles.slotKey
    });
  let changed = removed.length > 0;
  const currentSlotKeys = new Set(currentRows.map((row) => row.slotKey));

  for (const slot of slots) {
    const changedSlot = await upsertExtractedSlot(database, slot, cause);
    changed ||= changedSlot || !currentSlotKeys.has(slot.slotKey);
  }

  return changed;
}

async function upsertExtractedSlot(
  database: AppDatabase,
  slot: ExtractedTelegramFileSlot,
  cause: TelegramMediaDownloadPolicyCause
): Promise<boolean> {
  const assetKey = telegramFileAssetKey(slot);
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

  if (decision.action === 'enqueue' && asset.status !== 'ready') {
    await enqueueTelegramFileAssetDownload(database, assetKey, downloadPriorityForCause(cause));
  }

  const upserted = await database
    .insert(telegramFiles)
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
      source: slot.source,
      sourceFingerprint: telegramFileSourceFingerprint(slot.source),
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
        source: slot.source,
        sourceFingerprint: telegramFileSourceFingerprint(slot.source),
        tdlibFileId: slot.tdlibFileId,
        updatedAt: sql`now()`,
        width: slot.width
      },
      target: [telegramFiles.ownerModel, telegramFiles.ownerId, telegramFiles.slotKey]
    })
    .returning({
      slotKey: telegramFiles.slotKey
    });

  return upserted.length === 1;
}

async function upsertTelegramFileAsset(
  database: AppDatabase,
  slot: ExtractedTelegramFileSlot,
  assetKey: string
): Promise<{ assetKey: string; status: TelegramFileAssetStatus }> {
  const remoteId = sourceString(slot.source, 'remoteId');
  const remoteUniqueId = sourceString(slot.source, 'remoteUniqueId');
  const [asset] = await database
    .insert(telegramFileAssets)
    .values({
      assetKey,
      byteSize: slot.byteSize,
      latestRemoteId: remoteId,
      latestTdlibFileId: slot.tdlibFileId,
      provider: 'telegram',
      remoteUniqueId,
      status: 'known'
    })
    .onConflictDoUpdate({
      set: {
        byteSize: sql`coalesce(${telegramFileAssets.byteSize}, ${slot.byteSize})`,
        latestRemoteId: remoteId,
        latestTdlibFileId: slot.tdlibFileId,
        remoteUniqueId,
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
  database: AppDatabase,
  assetKey: string,
  priority: number
): Promise<void> {
  const [job] = await database
    .select({
      status: telegramFileDownloadJobs.status
    })
    .from(telegramFileDownloadJobs)
    .where(eq(telegramFileDownloadJobs.assetKey, assetKey))
    .limit(1);

  if (job === undefined) {
    await database.insert(telegramFileDownloadJobs).values({
      assetKey,
      priority,
      status: 'queued'
    });
    return;
  }

  if (job.status === 'queued' || job.status === 'downloading') {
    await database
      .update(telegramFileDownloadJobs)
      .set({
        priority: sql`greatest(${telegramFileDownloadJobs.priority}, ${priority})`,
        updatedAt: sql`now()`
      })
      .where(eq(telegramFileDownloadJobs.assetKey, assetKey));
    return;
  }

  await database
    .update(telegramFileDownloadJobs)
    .set({
      claimedAt: null,
      lastError: null,
      priority: sql`greatest(${telegramFileDownloadJobs.priority}, ${priority})`,
      status: 'queued',
      updatedAt: sql`now()`
    })
    .where(eq(telegramFileDownloadJobs.assetKey, assetKey));
}

function downloadPriorityForCause(cause: TelegramMediaDownloadPolicyCause): number {
  switch (cause) {
    case 'explicit_request':
      return telegramTdlibPriorities.p1;
    case 'operator_page':
      return telegramTdlibPriorities.p2;
    case 'initialization':
    case 'live_update':
      return telegramTdlibPriorities.p3;
    case 'history_fetch':
      return telegramTdlibPriorities.p4;
  }
}

async function readTelegramFileDownloadRow(
  database: AppDatabase,
  assetKey: string
): Promise<TelegramFileDownloadRow | null> {
  const [row] = await database
    .select({
      assetKey: telegramFileAssets.assetKey,
      byteSize: telegramFileAssets.byteSize,
      fileName: telegramFiles.fileName,
      latestTdlibFileId: telegramFileAssets.latestTdlibFileId,
      mimeType: telegramFiles.mimeType,
      priority: telegramFileDownloadJobs.priority
    })
    .from(telegramFileDownloadJobs)
    .innerJoin(
      telegramFileAssets,
      eq(telegramFileAssets.assetKey, telegramFileDownloadJobs.assetKey)
    )
    .leftJoin(telegramFiles, eq(telegramFiles.assetKey, telegramFileDownloadJobs.assetKey))
    .where(eq(telegramFileAssets.assetKey, assetKey))
    .limit(1);

  return row ?? null;
}

async function readTelegramFileRef(
  database: AppDatabase,
  owner: TelegramFileOwner,
  slotKey: string
): Promise<TelegramFileRef | null> {
  const row = await readTelegramFileRefRow(database, owner, slotKey);
  return row === null ? null : toTelegramFileRef(row);
}

async function readTelegramFileRefRow(
  database: AppDatabase,
  owner: TelegramFileOwner,
  slotKey: string
): Promise<TelegramFileRefRow | null> {
  const [row] = await readTelegramFileRefRows(database, [owner.id], {
    ownerModel: owner._model,
    slotKey
  });
  return row ?? null;
}

async function readTelegramFileRefRows(
  database: AppDatabase,
  ownerIds: string[],
  filter: { ownerModel?: TelegramFileOwnerModel; slotKey?: string } = {}
): Promise<TelegramFileRefRow[]> {
  const where = [
    inArray(telegramFiles.ownerId, ownerIds),
    filter.ownerModel === undefined ? undefined : eq(telegramFiles.ownerModel, filter.ownerModel),
    filter.slotKey === undefined ? undefined : eq(telegramFiles.slotKey, filter.slotKey)
  ].filter(
    (condition): condition is Exclude<typeof condition, undefined> => condition !== undefined
  );

  return database
    .select({
      assetByteSize: telegramFileAssets.byteSize,
      assetDownloadedByteSize: telegramFileAssets.downloadedByteSize,
      assetDownloadError: telegramFileAssets.downloadError,
      assetKey: telegramFiles.assetKey,
      assetRelativePath: telegramFileAssets.relativePath,
      assetStatus: telegramFileAssets.status,
      assetUpdatedAt: telegramFileAssets.updatedAt,
      byteSize: telegramFiles.byteSize,
      durationSeconds: telegramFiles.durationSeconds,
      fileName: telegramFiles.fileName,
      height: telegramFiles.height,
      jobStatus: telegramFileDownloadJobs.status,
      mediaKind: telegramFiles.mediaKind,
      mimeType: telegramFiles.mimeType,
      ownerId: telegramFiles.ownerId,
      ownerModel: telegramFiles.ownerModel,
      renderKind: telegramFiles.renderKind,
      slotKey: telegramFiles.slotKey,
      slotUpdatedAt: telegramFiles.updatedAt,
      source: telegramFiles.source,
      sourceFingerprint: telegramFiles.sourceFingerprint,
      tdlibFileId: telegramFiles.tdlibFileId,
      width: telegramFiles.width
    })
    .from(telegramFiles)
    .innerJoin(telegramFileAssets, eq(telegramFileAssets.assetKey, telegramFiles.assetKey))
    .leftJoin(
      telegramFileDownloadJobs,
      eq(telegramFileDownloadJobs.assetKey, telegramFiles.assetKey)
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

function extractedSlotFromRow(row: TelegramFileRefRow): ExtractedTelegramFileSlot {
  const source = assertTelegramFileSource(row.source);
  return {
    byteSize: row.byteSize,
    durationSeconds: row.durationSeconds,
    fileName: row.fileName,
    height: row.height,
    mediaKind: assertMediaKind(row.mediaKind),
    mimeType: row.mimeType,
    owner: ownerRef(assertOwnerModel(row.ownerModel), row.ownerId),
    renderKind: assertRenderKind(row.renderKind),
    slotKey: row.slotKey,
    source,
    tdlibFileId: row.tdlibFileId ?? source.fileId,
    width: row.width
  };
}

function telegramFileAssetKey(slot: ExtractedTelegramFileSlot): string {
  const remoteUniqueId = sourceString(slot.source, 'remoteUniqueId');
  return remoteUniqueId === null
    ? `source:${telegramFileSourceFingerprint(slot.source)}`
    : `telegram:${remoteUniqueId}`;
}

export function assertTelegramFileSource(source: JsonObject): TelegramFileSource {
  if (source.kind === 'tdlibFile' && typeof source.fileId === 'number') {
    return source as TelegramFileSource;
  }
  throw new Error('Telegram file source is invalid');
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

function ownerKey(owner: TelegramFileOwnerKey): string {
  return `${owner.ownerModel}:${owner.ownerId}`;
}

function uniqueOwners(owners: TelegramFileOwnerKey[]): TelegramFileOwnerKey[] {
  return [...new Map(owners.map((owner) => [ownerKey(owner), owner])).values()];
}

function sourceString(
  source: TelegramFileSource,
  key: 'remoteId' | 'remoteUniqueId'
): string | null {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function safeNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function aggregateNumber(value: unknown): number {
  const numberValue =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function maxDate(left: Date, right: Date): Date {
  return left > right ? left : right;
}

function assertAssetStatus(value: string): TelegramFileAssetStatus {
  if (value === 'failed' || value === 'known' || value === 'ready') {
    return value;
  }
  throw new Error(`Unsupported Telegram file asset status: ${value}`);
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
    value === 'video'
  ) {
    return value;
  }
  throw new Error(`Unsupported Telegram file media kind: ${value}`);
}

function assertRenderKind(value: string): TelegramFileRenderKind {
  if (value === 'download' || value === 'image' || value === 'video') {
    return value;
  }
  throw new Error(`Unsupported Telegram file render kind: ${value}`);
}
