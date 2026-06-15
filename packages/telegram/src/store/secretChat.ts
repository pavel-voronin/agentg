import type { Database } from '../database/client.js';
import { telegramSecretChats } from '../database/schema.js';
import { tdJsonObject, type UpdateByType } from '../tdlib/shape.js';

type SecretChat = UpdateByType<'updateSecretChat'>['secret_chat'];

export async function upsertSecretChat(database: Database, secretChat: SecretChat): Promise<void> {
  const row: typeof telegramSecretChats.$inferInsert = {
    id: secretChat.id,
    isOutbound: secretChat.is_outbound,
    keyHash: secretChat.key_hash,
    layer: secretChat.layer,
    state: tdJsonObject(secretChat.state),
    userId: String(secretChat.user_id)
  };

  await database.insert(telegramSecretChats).values(row).onConflictDoUpdate({
    set: row,
    target: telegramSecretChats.id
  });
}
