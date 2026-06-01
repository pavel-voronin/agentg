import { upsertTelegramFileDownload } from '../../store/fileDownload.js';
import { upsertTelegramKv } from '../../store/kv.js';
import { storeMessage } from '../../store/message.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type FileAddedToDownloadsUpdate = UpdateByType<'updateFileAddedToDownloads'>;

export async function handleUpdateFileAddedToDownloads(
  update: FileAddedToDownloadsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const fileDownload = update.file_download;
  await database.transaction(async (transaction) => {
    await storeMessage(transaction, fileDownload.message);
    await upsertTelegramFileDownload(transaction, fileDownload);
    await upsertTelegramKv(transaction, 'downloaded_file_counts', update.counts);
  });

  await events.publishTelegramFileDownloadsUpdated({
    counts: update.counts,
    fileId: fileDownload.file_id
  });
}
