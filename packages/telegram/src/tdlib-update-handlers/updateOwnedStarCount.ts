import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireOwnedStarCountUpdate = TelegramWireUpdateByType<'updateOwnedStarCount'>;

export function handleUpdateOwnedStarCount(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireOwnedStarCountUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'owned_star_count', update.star_amount);
}
