import { upsertTelegramFileDownload } from '../../store/fileDownload.js';
import { upsertTelegramKv } from '../../store/kv.js';
import { storeMessage } from '../../store/message.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type FileAddedToDownloadsUpdate = UpdateByType<'updateFileAddedToDownloads'>;

export async function handleUpdateFileAddedToDownloads(
  update: FileAddedToDownloadsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const fileDownload = update.file_download;
  await database.transaction(async (transaction) => {
    await storeMessage(transaction, fileDownload.message);
    await upsertTelegramFileDownload(transaction, fileDownload);
    await upsertTelegramKv(transaction, 'downloaded_file_counts', update.counts);
  });
}
