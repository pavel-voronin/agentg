import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireOwnedTonCountUpdate = TelegramWireUpdateByType<'updateOwnedTonCount'>;

export function handleUpdateOwnedTonCount(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireOwnedTonCountUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'owned_ton_count', update.ton_amount);
}
