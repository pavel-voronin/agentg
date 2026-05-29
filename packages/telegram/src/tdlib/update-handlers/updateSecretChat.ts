import type { TelegramWireUpdateByType } from '../wire.js';
import { upsertSecretChat } from '../../store/secretChat.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireSecretChatUpdate = TelegramWireUpdateByType<'updateSecretChat'>;

export function handleUpdateSecretChat(update: TelegramWireSecretChatUpdate): Promise<void> {
  const database = useDatabase();
  return upsertSecretChat(database, update.secret_chat);
}
