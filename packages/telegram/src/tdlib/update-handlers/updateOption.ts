import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireOptionUpdate = TelegramWireUpdateByType<'updateOption'>;

export function handleUpdateOption(update: TelegramWireOptionUpdate): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, `option:${update.name}`, update.value);
}
