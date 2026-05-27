import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';
import { upsertSecretChat } from '../telegram-store/secretChat.js';

type TelegramWireSecretChatUpdate = TelegramWireUpdateByType<'updateSecretChat'>;

export function handleUpdateSecretChat(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireSecretChatUpdate
): Promise<void> {
  return upsertSecretChat(database, update.secret_chat);
}
