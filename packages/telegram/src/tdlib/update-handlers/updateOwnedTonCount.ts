import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireOwnedTonCountUpdate = TelegramWireUpdateByType<'updateOwnedTonCount'>;

export function handleUpdateOwnedTonCount(update: TelegramWireOwnedTonCountUpdate): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'owned_ton_count', update.ton_amount);
}
