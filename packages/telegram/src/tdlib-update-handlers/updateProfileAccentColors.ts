import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

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
