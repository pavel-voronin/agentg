import { eq } from 'drizzle-orm';

import { telegramFileDownloads } from '../schema.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireFileRemovedFromDownloadsUpdate =
  TelegramWireUpdateByType<'updateFileRemovedFromDownloads'>;

export async function handleUpdateFileRemovedFromDownloads(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireFileRemovedFromDownloadsUpdate
): Promise<void> {
  await database
    .delete(telegramFileDownloads)
    .where(eq(telegramFileDownloads.fileId, update.file_id));

  await upsertTelegramKv(database, 'downloaded_file_counts', update.counts);
  events.publishTelegramFileDownloadRemoved(update);
}
