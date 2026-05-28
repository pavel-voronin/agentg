import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { upsertSecretChat } from '../../store/secretChat.js';

type TelegramWireSecretChatUpdate = TelegramWireUpdateByType<'updateSecretChat'>;

export function handleUpdateSecretChat(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireSecretChatUpdate
): Promise<void> {
  return upsertSecretChat(database, update.secret_chat);
}
