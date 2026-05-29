import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireOwnedStarCountUpdate = TelegramWireUpdateByType<'updateOwnedStarCount'>;

export function handleUpdateOwnedStarCount(
  update: TelegramWireOwnedStarCountUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'owned_star_count', update.star_amount);
}
