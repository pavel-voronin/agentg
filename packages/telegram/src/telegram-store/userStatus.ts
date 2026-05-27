import type { TelegramDatabase } from '../database.js';
import { telegramUsers } from '../schema.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireUserStatus = TelegramWireUpdateByType<'updateUserStatus'>['status'];

export async function storeUserStatus(
  database: TelegramDatabase,
  userId: number | string,
  status: TelegramWireUserStatus
): Promise<void> {
  const row = {
    id: String(userId),
    status: telegramWireJsonObject(status)
  };

  await database
    .insert(telegramUsers)
    .values(row)
    .onConflictDoUpdate({
      set: {
        status: row.status
      },
      target: telegramUsers.id
    });
}
