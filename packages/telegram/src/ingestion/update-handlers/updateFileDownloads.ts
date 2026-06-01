import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type FileDownloadsUpdate = UpdateByType<'updateFileDownloads'>;

const FILE_DOWNLOADS_STATE_KEY = 'file_downloads_state';

export async function handleUpdateFileDownloads(
  update: FileDownloadsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const state = {
    downloaded_size: update.downloaded_size,
    total_count: update.total_count,
    total_size: update.total_size
  };

  await upsertTelegramKv(database, FILE_DOWNLOADS_STATE_KEY, state);
  await events.publishTelegramFileDownloadsUpdated(state);
}
