import { patchTelegramFileDownload } from '../../store/fileDownload.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type FileDownloadUpdate = UpdateByType<'updateFileDownload'>;

export async function handleUpdateFileDownload(
  update: FileDownloadUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await patchTelegramFileDownload(database, {
    completeDate: update.complete_date,
    fileId: update.file_id,
    isPaused: update.is_paused
  });

  await upsertTelegramKv(database, 'downloaded_file_counts', update.counts);
}
