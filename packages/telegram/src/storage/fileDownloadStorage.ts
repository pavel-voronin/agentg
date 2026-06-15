import { eq } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramFileDownloads } from '../database/schema.js';
import type { FileDownloadPatch, FileDownload } from '../domain/models/fileDownload.js';

export type FileDownloadStorageRow = typeof telegramFileDownloads.$inferInsert;

export async function saveFileDownload(database: Database, download: FileDownload): Promise<void> {
  const row = fileDownloadStorageRow(download);
  await database.insert(telegramFileDownloads).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFileDownloads.fileId
  });
}

export async function patchFileDownload(
  database: Database,
  patch: FileDownloadPatch
): Promise<boolean> {
  const updated = await database
    .update(telegramFileDownloads)
    .set({
      completeDate: patch.completeDate,
      isPaused: patch.isPaused
    })
    .where(eq(telegramFileDownloads.fileId, patch.fileId))
    .returning({
      fileId: telegramFileDownloads.fileId
    });

  return updated.length > 0;
}

export async function deleteFileDownload(database: Database, fileId: number): Promise<void> {
  await database.delete(telegramFileDownloads).where(eq(telegramFileDownloads.fileId, fileId));
}

function fileDownloadStorageRow(download: FileDownload): FileDownloadStorageRow {
  return download;
}
