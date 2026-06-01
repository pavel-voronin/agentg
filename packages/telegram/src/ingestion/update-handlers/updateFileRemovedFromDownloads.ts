import { eq } from 'drizzle-orm';

import { telegramFileDownloads } from '../../database/schema.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type FileRemovedFromDownloadsUpdate = UpdateByType<'updateFileRemovedFromDownloads'>;

export async function handleUpdateFileRemovedFromDownloads(
  update: FileRemovedFromDownloadsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await database
    .delete(telegramFileDownloads)
    .where(eq(telegramFileDownloads.fileId, update.file_id));

  await upsertTelegramKv(database, 'downloaded_file_counts', update.counts);
  await events.publishTelegramFileDownloadRemoved(update);
}
