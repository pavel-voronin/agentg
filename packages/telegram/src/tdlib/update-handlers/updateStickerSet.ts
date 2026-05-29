import { upsertStickerSet } from '../../store/stickerSet.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireStickerSetUpdate = TelegramWireUpdateByType<'updateStickerSet'>;

export async function handleUpdateStickerSet(update: TelegramWireStickerSetUpdate): Promise<void> {
  const database = useDatabase();
  const files = useFiles();
  await upsertStickerSet(database, update.sticker_set);
  await files.recordStickerSetFiles(update.sticker_set, 'live_update');
}
