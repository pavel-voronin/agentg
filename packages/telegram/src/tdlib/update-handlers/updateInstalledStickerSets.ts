import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireInstalledStickerSetsUpdate =
  TelegramWireUpdateByType<'updateInstalledStickerSets'>;

export function handleUpdateInstalledStickerSets(
  update: TelegramWireInstalledStickerSetsUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(
    database,
    `installed_sticker_sets_by_type:${update.sticker_type._}`,
    update.sticker_set_ids
  );
}
