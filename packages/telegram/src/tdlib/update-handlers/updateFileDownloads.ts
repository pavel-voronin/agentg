import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireFileDownloadsUpdate = TelegramWireUpdateByType<'updateFileDownloads'>;

const FILE_DOWNLOADS_STATE_KEY = 'file_downloads_state';

export async function handleUpdateFileDownloads(
  update: TelegramWireFileDownloadsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const state = {
    downloaded_size: update.downloaded_size,
    total_count: update.total_count,
    total_size: update.total_size
  };

  await upsertTelegramKv(database, FILE_DOWNLOADS_STATE_KEY, state);
  events.publishTelegramFileDownloadsUpdated(state);
}
