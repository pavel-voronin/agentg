import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireOwnedTonCountUpdate = TelegramWireUpdateByType<'updateOwnedTonCount'>;

export function handleUpdateOwnedTonCount(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireOwnedTonCountUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'owned_ton_count', update.ton_amount);
}
