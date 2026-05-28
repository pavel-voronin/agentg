import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireInstalledStickerSetsUpdate =
  TelegramWireUpdateByType<'updateInstalledStickerSets'>;

export function handleUpdateInstalledStickerSets(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireInstalledStickerSetsUpdate
): Promise<void> {
  return upsertTelegramKv(
    database,
    `installed_sticker_sets_by_type:${update.sticker_type._}`,
    update.sticker_set_ids
  );
}
