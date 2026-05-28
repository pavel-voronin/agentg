import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramFileDownload } from '../../store/fileDownload.js';
import { upsertTelegramKv } from '../../store/kv.js';
import { storeMessage } from '../../store/message.js';
import type { TelegramWireUpdateByType } from '../wire.js';

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
