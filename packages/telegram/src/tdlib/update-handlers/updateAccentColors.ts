import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireAccentColorsUpdate = TelegramWireUpdateByType<'updateAccentColors'>;

export function handleUpdateAccentColors(update: TelegramWireAccentColorsUpdate): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'accent_colors', {
    colors: update.colors,
    available_accent_color_ids: update.available_accent_color_ids
  });
}
