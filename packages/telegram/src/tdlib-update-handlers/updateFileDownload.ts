import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { patchTelegramFileDownload } from '../telegram-store/fileDownload.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireFileDownloadUpdate = TelegramWireUpdateByType<'updateFileDownload'>;

export async function handleUpdateFileDownload(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireFileDownloadUpdate
): Promise<void> {
  const downloadRowPatched = await patchTelegramFileDownload(database, {
    completeDate: update.complete_date,
    fileId: update.file_id,
    isPaused: update.is_paused
  });

  await upsertTelegramKv(database, 'downloaded_file_counts', update.counts);
  events.publishTelegramFileDownloadUpdated(update, { downloadRowPatched });
}
