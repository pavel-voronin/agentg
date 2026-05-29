import { eq } from 'drizzle-orm';

import { telegramFileDownloads } from '../../database/schema.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireFileRemovedFromDownloadsUpdate =
  TelegramWireUpdateByType<'updateFileRemovedFromDownloads'>;

export async function handleUpdateFileRemovedFromDownloads(
  update: TelegramWireFileRemovedFromDownloadsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await database
    .delete(telegramFileDownloads)
    .where(eq(telegramFileDownloads.fileId, update.file_id));

  await upsertTelegramKv(database, 'downloaded_file_counts', update.counts);
  events.publishTelegramFileDownloadRemoved(update);
}
