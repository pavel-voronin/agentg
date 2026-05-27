import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireSavedAnimationsUpdate = TelegramWireUpdateByType<'updateSavedAnimations'>;

export function handleUpdateSavedAnimations(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireSavedAnimationsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'saved_animations', update.animation_ids);
}
