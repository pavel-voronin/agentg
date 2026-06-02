import type { Database } from '../database/client.js';
import { telegramBusinessConnections } from '../database/schema.js';
import { tdDate, tdJsonValue, type UpdateByType } from '../tdlib/value.js';

type BusinessConnection = UpdateByType<'updateBusinessConnection'>['connection'];

export async function storeBusinessConnection(
  database: Database,
  connection: BusinessConnection
): Promise<void> {
  const row: typeof telegramBusinessConnections.$inferInsert = {
    date: requiredTelegramDate(connection.date),
    id: connection.id,
    isEnabled: connection.is_enabled,
    rights: connection.is_enabled ? (tdJsonValue(connection.rights ?? null) ?? null) : null,
    userChatId: String(connection.user_chat_id),
    userId: String(connection.user_id)
  };

  await database.insert(telegramBusinessConnections).values(row).onConflictDoUpdate({
    set: row,
    target: telegramBusinessConnections.id
  });
}

function requiredTelegramDate(value: number): Date {
  const date = tdDate(value);
  if (date === undefined) {
    throw new Error(`Business connection has invalid date: ${String(value)}`);
  }
  return date;
}
