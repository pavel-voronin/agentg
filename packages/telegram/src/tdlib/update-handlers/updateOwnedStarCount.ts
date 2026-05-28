import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireOwnedStarCountUpdate = TelegramWireUpdateByType<'updateOwnedStarCount'>;

export function handleUpdateOwnedStarCount(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireOwnedStarCountUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'owned_star_count', update.star_amount);
}
