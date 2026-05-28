import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireAccentColorsUpdate = TelegramWireUpdateByType<'updateAccentColors'>;

export function handleUpdateAccentColors(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireAccentColorsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'accent_colors', {
    colors: update.colors,
    available_accent_color_ids: update.available_accent_color_ids
  });
}
