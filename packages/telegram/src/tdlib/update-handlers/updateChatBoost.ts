import { storeChatBoost } from '../../store/chatBoost.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireChatBoostUpdate = TelegramWireUpdateByType<'updateChatBoost'>;

export async function handleUpdateChatBoost(update: TelegramWireChatBoostUpdate): Promise<void> {
  const database = useDatabase();
  await storeChatBoost(database, update);
}
