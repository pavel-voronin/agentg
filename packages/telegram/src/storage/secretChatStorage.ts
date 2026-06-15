import type { Database } from '../database/client.js';
import { telegramSecretChats } from '../database/schema.js';
import type { SecretChatState } from '../domain/models/secretChat.js';

export type SecretChatStorageRow = typeof telegramSecretChats.$inferInsert;

export async function saveSecretChatState(
  database: Database,
  chat: SecretChatState
): Promise<void> {
  const row = secretChatStorageRow(chat);
  await database.insert(telegramSecretChats).values(row).onConflictDoUpdate({
    set: row,
    target: telegramSecretChats.id
  });
}

function secretChatStorageRow(chat: SecretChatState): SecretChatStorageRow {
  return chat;
}
