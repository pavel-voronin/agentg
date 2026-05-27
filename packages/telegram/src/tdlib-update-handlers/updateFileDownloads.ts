import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireFileDownloadsUpdate = TelegramWireUpdateByType<'updateFileDownloads'>;

const FILE_DOWNLOADS_STATE_KEY = 'file_downloads_state';

export async function handleUpdateFileDownloads(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireFileDownloadsUpdate
): Promise<void> {
  const state = {
    downloaded_size: update.downloaded_size,
    total_count: update.total_count,
    total_size: update.total_size
  };

  await upsertTelegramKv(database, FILE_DOWNLOADS_STATE_KEY, state);
  events.publishTelegramFileDownloadsUpdated(state);
}
