import type { TelegramDatabase } from '../database/client.js';
import { telegramBusinessConnections } from '../database/schema.js';
import {
  telegramWireDate,
  telegramWireJsonValue,
  type TelegramWireUpdateByType
} from '../tdlib/wire.js';

type TelegramWireBusinessConnection =
  TelegramWireUpdateByType<'updateBusinessConnection'>['connection'];

export async function storeBusinessConnection(
  database: TelegramDatabase,
  connection: TelegramWireBusinessConnection
): Promise<void> {
  const row: typeof telegramBusinessConnections.$inferInsert = {
    date: requiredTelegramDate(connection.date),
    id: connection.id,
    isEnabled: connection.is_enabled,
    rights: connection.is_enabled
      ? (telegramWireJsonValue(connection.rights ?? null) ?? null)
      : null,
    userChatId: String(connection.user_chat_id),
    userId: String(connection.user_id)
  };

  await database.insert(telegramBusinessConnections).values(row).onConflictDoUpdate({
    set: row,
    target: telegramBusinessConnections.id
  });
}

function requiredTelegramDate(value: number): Date {
  const date = telegramWireDate(value);
  if (date === undefined) {
    throw new Error(`Business connection has invalid date: ${String(value)}`);
  }
  return date;
}
