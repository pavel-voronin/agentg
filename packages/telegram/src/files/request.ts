import { and, eq } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramFileAssets,
  telegramFileDownloadJobs,
  telegramFileSlots
} from '../database/schema.js';
import { publishFileOwnerUpdated, publishFileQueueUpdated } from './events.js';
import {
  assertMediaKind,
  downloadPriorityForCause,
  enqueueFileAssetDownload
} from './persistence.js';
import { decideFilePolicy } from './policy.js';
import { readFileRef } from './read.js';
import type { FileRequestResult, FileSubsystemOptions } from './runtime.js';
import type { FileOwner } from './types.js';

type RequestFileSlotOptions = Pick<FileSubsystemOptions, 'database' | 'events'>;

type RequestFileSlotRow = {
  assetKey: string;
  assetStatus: string;
  byteSize: number | null;
  jobStatus: string | null;
  mediaKind: string;
};

export async function requestFileSlot(
  options: RequestFileSlotOptions,
  input: { owner: FileOwner; slotKey: string }
): Promise<FileRequestResult> {
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

  const decision = decideFilePolicy({
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
    await enqueueFileAssetDownload(
      options.database,
      row.assetKey,
      downloadPriorityForCause('explicit_request')
    );
    publishFileOwnerUpdated(options, {
      ownerId: input.owner.id,
      ownerModel: input.owner._model
    });
    await publishFileQueueUpdated(options);
  }

  return {
    decision,
    file: await readFileRef(options.database, input.owner, input.slotKey)
  };
}

async function readRequestFileSlotRow(
  database: Database,
  owner: FileOwner,
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
