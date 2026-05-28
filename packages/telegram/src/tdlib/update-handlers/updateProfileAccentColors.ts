import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireProfileAccentColorsUpdate = TelegramWireUpdateByType<'updateProfileAccentColors'>;

export function handleUpdateProfileAccentColors(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireProfileAccentColorsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'profile_accent_colors', {
    colors: update.colors,
    available_accent_color_ids: update.available_accent_color_ids
  });
}
