import { and, eq } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramFileAssets,
  telegramFileDownloadJobs,
  telegramFileSlots
} from '../database/schema.js';
import type { FileOwner } from '../domain/models/fileRef.js';

export type RequestFileSlotRow = {
  assetKey: string;
  assetStatus: string;
  byteSize: number | null;
  downloadError: string | null;
  jobStatus: string | null;
  mediaKind: string;
};

export async function readRequestFileSlotRow(
  database: Database,
  owner: FileOwner,
  slotKey: string
): Promise<RequestFileSlotRow | null> {
  const [row] = await database
    .select({
      assetKey: telegramFileSlots.assetKey,
      assetStatus: telegramFileAssets.status,
      byteSize: telegramFileSlots.byteSize,
      downloadError: telegramFileAssets.downloadError,
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
