import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireProfileAccentColorsUpdate = TelegramWireUpdateByType<'updateProfileAccentColors'>;

export function handleUpdateProfileAccentColors(
  update: TelegramWireProfileAccentColorsUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'profile_accent_colors', {
    colors: update.colors,
    available_accent_color_ids: update.available_accent_color_ids
  });
}
