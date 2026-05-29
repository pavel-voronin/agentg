import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireDiceEmojisUpdate = TelegramWireUpdateByType<'updateDiceEmojis'>;

export function handleUpdateDiceEmojis(update: TelegramWireDiceEmojisUpdate): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'dice_emojis', update.emojis);
}
