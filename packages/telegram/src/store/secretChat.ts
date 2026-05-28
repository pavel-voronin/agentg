import type { TelegramDatabase } from '../database.js';
import { telegramSecretChats } from '../schema.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../tdlib/wire.js';

type TelegramWireSecretChat = TelegramWireUpdateByType<'updateSecretChat'>['secret_chat'];

export async function upsertSecretChat(
  database: TelegramDatabase,
  secretChat: TelegramWireSecretChat
): Promise<void> {
  const row: typeof telegramSecretChats.$inferInsert = {
    id: secretChat.id,
    isOutbound: secretChat.is_outbound,
    keyHash: secretChat.key_hash,
    layer: secretChat.layer,
    state: telegramWireJsonObject(secretChat.state),
    userId: String(secretChat.user_id)
  };

  await database.insert(telegramSecretChats).values(row).onConflictDoUpdate({
    set: row,
    target: telegramSecretChats.id
  });
}
