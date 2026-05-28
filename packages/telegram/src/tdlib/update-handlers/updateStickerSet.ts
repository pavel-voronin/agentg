import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertStickerSet } from '../../store/stickerSet.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireStickerSetUpdate = TelegramWireUpdateByType<'updateStickerSet'>;

export async function handleUpdateStickerSet(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireStickerSetUpdate
): Promise<void> {
  await upsertStickerSet(context.database, update.sticker_set);
  await context.files.recordStickerSetFiles(update.sticker_set, 'live_update');
}
