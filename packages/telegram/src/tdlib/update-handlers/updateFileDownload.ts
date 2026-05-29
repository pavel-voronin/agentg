import { patchTelegramFileDownload } from '../../store/fileDownload.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireFileDownloadUpdate = TelegramWireUpdateByType<'updateFileDownload'>;

export async function handleUpdateFileDownload(
  update: TelegramWireFileDownloadUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const downloadRowPatched = await patchTelegramFileDownload(database, {
    completeDate: update.complete_date,
    fileId: update.file_id,
    isPaused: update.is_paused
  });

  await upsertTelegramKv(database, 'downloaded_file_counts', update.counts);
  events.publishTelegramFileDownloadUpdated(update, { downloadRowPatched });
}
