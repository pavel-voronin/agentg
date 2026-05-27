import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramFileDownload } from '../telegram-store/fileDownload.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import { storeMessage } from '../telegram-store/message.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireFileAddedToDownloadsUpdate =
  TelegramWireUpdateByType<'updateFileAddedToDownloads'>;

export async function handleUpdateFileAddedToDownloads(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireFileAddedToDownloadsUpdate
): Promise<void> {
  const fileDownload = update.file_download;
  await database.transaction(async (transaction) => {
    await storeMessage(transaction, fileDownload.message);
    await upsertTelegramFileDownload(transaction, fileDownload);
    await upsertTelegramKv(transaction, 'downloaded_file_counts', update.counts);
  });

  events.publishTelegramFileDownloadsUpdated({
    counts: update.counts,
    fileId: fileDownload.file_id
  });
}
